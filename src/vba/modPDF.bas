Attribute VB_Name = "modPDF"
'==============================================================================
' Module      : modPDF
' Purpose     : Stage 8 - plot the latest saved DWG to
'               "<Part Number>.pdf" in the part's PDF folder and verify it.
'               Topics 26, 27, 87, 102, 103.
'==============================================================================
Option Explicit

'==============================================================================
' Topic 114 - ConvertDWGToPDF
'==============================================================================
Public Function ConvertDWGToPDF(ByVal r As ListRow, _
                                Optional ByVal announce As Boolean = False, _
                                Optional ByVal forceRegenerate As Boolean = False) As Boolean
    Dim acadApp As Object, doc As Object
    Dim dwgPath As String, pdfPath As String
    Dim openedHere As Boolean
    Dim plotted As Boolean
    Dim backupPath As String
    Dim dwgStamp As Date, pdfStamp As Date

    On Error GoTo ErrorHandler

    If r Is Nothing Then Exit Function

    '--- Topic 26 - PDF approval gate ---
    If Not IsYes(MLGet(r, COL_PDFOK)) Then
        UpdatePDFStatus r, ST_WAITING, ACT_PDF, RES_WAIT, "PDF OK = NO"
        UpdateAutomationStatus r, ST_WAITING, ACT_PDF, RES_WAIT
        If announce Then
            InfoBox "PDF OK is not YES for this part." & vbCrLf & vbCrLf & _
                    "Set PDF OK = YES in MASTER_LIST, then run the PDF stage again."
        End If
        Exit Function
    End If

    dwgPath = DwgFileFor(r)
    pdfPath = PdfFileFor(r)

    '--- Topic 87 - the DWG must exist ---
    If Not FileExists(dwgPath) Then
        Fail "modPDF.ConvertDWGToPDF", _
             "The drawing does not exist, so no PDF can be produced:" & vbCrLf & dwgPath
    End If

    '--- Topic 102 - do not recreate an up-to-date PDF ---
    If FileExists(pdfPath) And Not forceRegenerate Then
        dwgStamp = FileModified(dwgPath)
        pdfStamp = FileModified(pdfPath)
        If pdfStamp >= dwgStamp Then
            MLSet r, COL_PDFPATH, pdfPath
            MLSetIfBlank r, COL_PDFCREATED, pdfStamp
            UpdatePDFStatus r, ST_CREATED, ACT_PDF, RES_INFO
            If announce Then
                InfoBox "The PDF is already up to date and was reused:" & vbCrLf & vbCrLf & pdfPath
            End If
            ConvertDWGToPDF = True
            Exit Function
        End If
    End If

    If Not EnsureFolder(PdfFolderFor(r)) Then
        Fail "modPDF.ConvertDWGToPDF", "The PDF folder could not be created:" & vbCrLf & PdfFolderFor(r)
    End If

    SetStatusBar "Connecting to AutoCAD for PDF plotting ..."
    Set acadApp = GetAcadApp(True)

    '--- Use the drawing that is already open, otherwise open it ---
    Set doc = AcadDocumentIfOpen(acadApp, dwgPath)
    If doc Is Nothing Then
        Set doc = acadApp.Documents.Open(dwgPath)
        openedHere = True
    End If

    '--- Topic 27/87 - the PDF must come from the latest SAVED drawing ---
    On Error Resume Next
    If doc.Saved = False Then
        doc.Save
        LogRowAction r, ACT_PDF, vbNullString, vbNullString, RES_INFO, _
                     "Unsaved drawing changes were saved before plotting."
    End If
    Err.Clear
    On Error GoTo ErrorHandler

    '--- An existing PDF is backed up, then removed so the plot cannot prompt ---
    If FileExists(pdfPath) Then
        If GetConfigBool(CFG_BACKUPENABLED, True) Then
            backupPath = BackupFile(pdfPath, EnsureBackupFolder(r))
            If Len(backupPath) > 0 Then
                LogRowAction r, ACT_BACKUP, vbNullString, vbNullString, RES_OK, _
                             "PDF backed up to " & backupPath
            End If
        End If
        On Error Resume Next
        FSO.DeleteFile pdfPath, True
        Err.Clear
        On Error GoTo ErrorHandler
    End If

    SetStatusBar "Plotting " & FSO.GetFileName(pdfPath) & " ..."
    plotted = PlotToPdf(doc, pdfPath)

    If Not plotted Then
        ' Documented fallback: the -EXPORT command with FILEDIA suppressed.
        LogRowAction r, ACT_PDF, vbNullString, vbNullString, RES_INFO, _
                     "PlotToFile did not succeed - trying the -EXPORT fallback."
        plotted = ExportPdfFallback(doc, pdfPath)
    End If

    If openedHere And GetConfigBool(CFG_CLOSEDWG, False) Then
        On Error Resume Next
        doc.Close False
        Err.Clear
        On Error GoTo ErrorHandler
    End If

    '--- Verify the PDF really exists and is not empty ---
    If Not WaitForFile(pdfPath, GetConfigDouble(CFG_PLOTTIMEOUT, 120)) Then
        Fail "modPDF.ConvertDWGToPDF", _
             "PDF creation failed - the file was not produced:" & vbCrLf & pdfPath & vbCrLf & vbCrLf & _
             "Check the '" & CFG_PLOTCONFIG & "' entry in CONFIG (currently '" & _
             GetConfigValue(CFG_PLOTCONFIG, "DWG To PDF.pc3") & "')."
    End If

    If FileSizeBytes(pdfPath) <= 0 Then
        Fail "modPDF.ConvertDWGToPDF", "The PDF was produced but is empty (0 bytes):" & vbCrLf & pdfPath
    End If

    MLSet r, COL_PDFPATH, pdfPath
    MLSet r, COL_PDFCREATED, Now
    ClearError r
    UpdatePDFStatus r, ST_CREATED, ACT_PDF, RES_OK
    SetStatusBar vbNullString

    ' Topic 104 - a fresh PDF invalidates any earlier mail approval.
    InvalidateMailForNewPDF r
    ApplyChangeDetection r

    If announce Then
        InfoBox "PDF created:" & vbCrLf & vbCrLf & pdfPath & vbCrLf & vbCrLf & _
                "Size: " & Format$(FileSizeBytes(pdfPath) / 1024, "#,##0") & " KB"
    End If

    Set doc = Nothing
    ConvertDWGToPDF = True
    Exit Function

ErrorHandler:
    SetStatusBar vbNullString
    Set doc = Nothing
    RecordError r, ACT_PDF, ErrText("modPDF.ConvertDWGToPDF"), COL_PDFSTATUS, announce
End Function

'==============================================================================
' Plot the active layout of a drawing to a PDF file
'==============================================================================
Private Function PlotToPdf(ByVal doc As Object, ByVal pdfPath As String) As Boolean
    Dim layout As Object
    Dim device As String, paper As String, styleSheet As String
    Dim isModel As Boolean

    device = GetConfigValue(CFG_PLOTCONFIG, "DWG To PDF.pc3")
    paper = GetConfigValue(CFG_PLOTPAPER, vbNullString)
    styleSheet = GetConfigValue(CFG_PLOTSTYLE, vbNullString)

    On Error GoTo PlotFailed

    On Error Resume Next
    doc.SetVariable "BACKGROUNDPLOT", 0      ' plot in the foreground so we can verify
    doc.SetVariable "FILEDIA", 1
    Err.Clear
    On Error GoTo PlotFailed

    Set layout = doc.ActiveLayout
    isModel = (UCase$(layout.Name) = "MODEL")

    On Error Resume Next
    layout.RefreshPlotDeviceInfo
    layout.ConfigName = device
    If Err.Number <> 0 Then
        Err.Clear
        On Error GoTo PlotFailed
        Fail "modPDF.PlotToPdf", _
             "The plot device '" & device & "' is not available in AutoCAD." & vbCrLf & _
             "Correct '" & CFG_PLOTCONFIG & "' in CONFIG."
    End If

    If Len(paper) > 0 Then layout.CanonicalMediaName = paper
    If Len(styleSheet) > 0 Then
        layout.StyleSheet = styleSheet
        layout.PlotWithPlotStyles = True
    End If

    layout.PlotWithLineweights = True
    layout.CenterPlot = True
    layout.PlotHidden = False

    If isModel Then
        layout.PlotType = 1                  ' acExtents
        layout.UseStandardScale = True
        layout.StandardScale = 0             ' acScaleToFit
    Else
        layout.PlotType = 5                  ' acLayout
    End If
    layout.RefreshPlotDeviceInfo
    Err.Clear
    On Error GoTo PlotFailed

    doc.Plot.NumberOfCopies = 1
    On Error Resume Next
    doc.Plot.QuietErrorMode = True
    Err.Clear
    On Error GoTo PlotFailed

    PlotToPdf = doc.Plot.PlotToFile(pdfPath, device)
    Exit Function

PlotFailed:
    PlotToPdf = False
End Function

'==============================================================================
' Fallback: the command-line -EXPORT with the file dialog suppressed
'==============================================================================
Private Function ExportPdfFallback(ByVal doc As Object, ByVal pdfPath As String) As Boolean
    Dim cmd As String
    Dim oldFiledia As Variant

    On Error GoTo Nope

    On Error Resume Next
    oldFiledia = doc.GetVariable("FILEDIA")
    doc.SetVariable "FILEDIA", 0
    Err.Clear
    On Error GoTo Nope

    ' -EXPORT  ->  format PDF  ->  Current layout  ->  file name
    cmd = "_.-EXPORT" & vbCr & "_PDF" & vbCr & "_C" & vbCr & pdfPath & vbCr
    doc.SendCommand cmd

    ExportPdfFallback = WaitForFile(pdfPath, GetConfigDouble(CFG_PLOTTIMEOUT, 120))

    On Error Resume Next
    If Not IsEmpty(oldFiledia) Then doc.SetVariable "FILEDIA", oldFiledia
    Err.Clear
    On Error GoTo 0
    Exit Function

Nope:
    On Error Resume Next
    If Not IsEmpty(oldFiledia) Then doc.SetVariable "FILEDIA", oldFiledia
    Err.Clear
    On Error GoTo 0
    ExportPdfFallback = False
End Function

'==============================================================================
' Topic 114 - OpenPDFFile
'==============================================================================
Public Sub OpenPDFFile()
    Dim r As ListRow, p As String
    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub
    p = PdfFileFor(r)
    If Not FileExists(p) Then
        WarnBox "The PDF has not been created yet:" & vbCrLf & vbCrLf & p
        Exit Sub
    End If
    ShellOpen p
End Sub
