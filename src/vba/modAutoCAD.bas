Attribute VB_Name = "modAutoCAD"
'==============================================================================
' Module      : modAutoCAD
' Purpose     : Stage 5 - AutoCAD 2026 automation through late-bound COM.
'               Detect / start AutoCAD, open the configured template, insert the
'               route blocks, write the drawing metadata, save as
'               "<Part Number>.dwg" and verify it on disk.
'               Topics 18, 19, 22, 23, 24, 94, 95.
'==============================================================================
Option Explicit

Private mAcadApp As Object

'==============================================================================
' Connection handling
'==============================================================================
'--- Attach to a running AutoCAD, or start one. Never closes other drawings. ---
Public Function GetAcadApp(Optional ByVal startIfMissing As Boolean = True) As Object
    Dim progId As String
    Dim visible As Boolean

    If Not mAcadApp Is Nothing Then
        ' Verify the cached reference is still alive.
        On Error Resume Next
        Dim probe As String
        probe = mAcadApp.Name
        If Err.Number <> 0 Then
            Err.Clear
            Set mAcadApp = Nothing
        End If
        On Error GoTo 0
    End If

    If Not mAcadApp Is Nothing Then
        Set GetAcadApp = mAcadApp
        Exit Function
    End If

    progId = GetConfigValue(CFG_ACADAPP, "AutoCAD.Application")
    visible = GetConfigBool(CFG_ACADVISIBLE, True)

    On Error Resume Next
    Set mAcadApp = GetObject(, progId)
    On Error GoTo 0

    If mAcadApp Is Nothing And startIfMissing Then
        On Error Resume Next
        Set mAcadApp = CreateObject(progId)
        On Error GoTo 0
    End If

    If mAcadApp Is Nothing Then
        Fail "modAutoCAD.GetAcadApp", _
             "AutoCAD is not available." & vbCrLf & vbCrLf & _
             "Tried to connect to '" & progId & "'." & vbCrLf & _
             "Start AutoCAD 2026 manually, or correct the '" & CFG_ACADAPP & _
             "' entry in CONFIG."
    End If

    On Error Resume Next
    mAcadApp.Visible = visible
    On Error GoTo 0

    WaitForAcadReady mAcadApp
    Set GetAcadApp = mAcadApp
End Function

'--- Bounded wait until AutoCAD answers COM calls (no endless loop) ------------
Public Sub WaitForAcadReady(ByVal acadApp As Object)
    Dim startedAt As Double, timeoutSec As Double
    Dim ready As Boolean, dummy As String

    timeoutSec = GetConfigDouble(CFG_ACADTIMEOUT, 120)
    startedAt = Timer

    Do
        On Error Resume Next
        Err.Clear
        dummy = acadApp.Name
        ready = (Err.Number = 0)
        Err.Clear
        On Error GoTo 0
        If ready Then Exit Do
        DoEvents
        If Timer < startedAt Then startedAt = Timer
    Loop While (Timer - startedAt) < timeoutSec

    If Not ready Then
        Fail "modAutoCAD.WaitForAcadReady", _
             "AutoCAD did not become ready within " & timeoutSec & " seconds."
    End If
End Sub

'--- Release the cached reference (topic 94) -----------------------------------
Public Sub ReleaseAcad()
    Set mAcadApp = Nothing
End Sub

'--- The open document for a given path, or Nothing ----------------------------
Public Function AcadDocumentIfOpen(ByVal acadApp As Object, ByVal fullPath As String) As Object
    Dim d As Object
    On Error Resume Next
    For Each d In acadApp.Documents
        If StrComp(d.FullName, fullPath, vbTextCompare) = 0 Then
            Set AcadDocumentIfOpen = d
            Exit Function
        End If
    Next d
    On Error GoTo 0
End Function

'==============================================================================
' Topic 114 - CreateAutoCADDrawing
'==============================================================================
Public Function CreateAutoCADDrawing(ByVal r As ListRow, _
                                     Optional ByVal announce As Boolean = False, _
                                     Optional ByVal forceRegenerate As Boolean = False) As Boolean
    Dim acadApp As Object, doc As Object
    Dim templatePath As String, targetPath As String
    Dim steps_ As Collection
    Dim inserted As Long
    Dim closeAfter As Boolean
    Dim backupPath As String

    On Error GoTo ErrorHandler

    If r Is Nothing Then Exit Function

    If MLGetStr(r, COL_EXCELSTATUS) <> ST_CREATED Then
        Fail "modAutoCAD.CreateAutoCADDrawing", _
             "The process Excel is not ready. Create it before the drawing."
    End If

    templatePath = TemplateFor(r)
    targetPath = DwgFileFor(r)

    '--- Topic 19 / 95 - template must exist ---
    If Len(templatePath) = 0 Or Not FileExists(templatePath) Then
        Fail "modAutoCAD.CreateAutoCADDrawing", _
             "AutoCAD template not found." & vbCrLf & vbCrLf & _
             IIf(Len(templatePath) = 0, "(no template configured)", templatePath)
    End If

    Set steps_ = RouteProcessDefs(r)
    If steps_.Count = 0 Then
        Fail "modAutoCAD.CreateAutoCADDrawing", "The route produced no process steps."
    End If

    '--- Idempotence: an existing drawing is reused unless a regenerate was
    '    explicitly requested (topics 47, 62). ---
    If FileExists(targetPath) And Not forceRegenerate Then
        MLSet r, COL_DWGPATH, targetPath
        MLSetIfBlank r, COL_DWGCREATED, FileModified(targetPath)
        If MLGetStr(r, COL_DWGSTATUS) <> ST_EDITED Then
            UpdateDWGStatus r, ST_CREATED, ACT_DWG, RES_INFO
        End If
        If announce Then
            InfoBox "The drawing already exists and was reused:" & vbCrLf & vbCrLf & targetPath & _
                    vbCrLf & vbCrLf & "Use RESET / REPROCESS to regenerate it."
        End If
        CreateAutoCADDrawing = True
        Exit Function
    End If

    '--- Topics 50/91 - back the existing production drawing up first ---
    If FileExists(targetPath) And forceRegenerate Then
        If GetConfigBool(CFG_BACKUPENABLED, True) Then
            backupPath = BackupFile(targetPath, EnsureBackupFolder(r))
            If Len(backupPath) > 0 Then
                LogRowAction r, ACT_BACKUP, vbNullString, vbNullString, RES_OK, _
                             "DWG backed up to " & backupPath
            End If
        End If
    End If

    SetStatusBar "Connecting to AutoCAD ..."
    Set acadApp = GetAcadApp(True)

    SetStatusBar "Opening template " & FSO.GetFileName(templatePath) & " ..."
    ' The template is opened read-only, then saved under the part name, so the
    ' template itself can never be modified.
    Set doc = acadApp.Documents.Open(templatePath, True)
    WaitForDocument doc

    '--- Topics 20/21/22 - blocks ---
    SetStatusBar "Inserting process blocks ..."
    inserted = InsertProcessBlocks(doc, r, steps_)

    '--- Topic 18 step 13 - drawing metadata ---
    PopulateDrawingMetadata doc, r

    '--- Topic 23 - process tables tied to the Excel sheets ---
    If UCase$(GetConfigValue(CFG_DWGTABLEMODE, "TABLE")) <> "NONE" Then
        SetStatusBar "Building process tables ..."
        UpdateAutoCADTables doc, r, steps_
    End If

    '--- Save as <Part Number>.dwg in the DWG folder (topic 24) ---
    SetStatusBar "Saving " & FSO.GetFileName(targetPath) & " ..."
    On Error Resume Next
    Err.Clear
    doc.SaveAs targetPath
    If Err.Number <> 0 Then
        Dim saveErr As String
        saveErr = Err.Description
        Err.Clear
        On Error GoTo ErrorHandler
        Fail "modAutoCAD.CreateAutoCADDrawing", _
             "DWG save failed:" & vbCrLf & targetPath & vbCrLf & vbCrLf & saveErr
    End If
    On Error GoTo ErrorHandler

    If Not WaitForFile(targetPath, 30) Then
        Fail "modAutoCAD.CreateAutoCADDrawing", _
             "The drawing was not found on disk after saving:" & vbCrLf & targetPath
    End If

    closeAfter = GetConfigBool(CFG_CLOSEDWG, False)
    If closeAfter Then
        On Error Resume Next
        doc.Close True
        On Error GoTo ErrorHandler
    End If

    MLSet r, COL_DWGPATH, targetPath
    MLSet r, COL_DWGCREATED, Now
    If forceRegenerate Then MLSet r, COL_DWGEDITED, vbNullString
    ClearError r
    UpdateDWGStatus r, ST_CREATED, ACT_DWG, RES_OK
    SetStatusBar vbNullString

    If announce Then
        InfoBox "AutoCAD drawing created:" & vbCrLf & vbCrLf & targetPath & vbCrLf & vbCrLf & _
                inserted & " process block(s) inserted in route order:" & vbCrLf & _
                MLGetStr(r, COL_ROUTE)
    End If

    Set doc = Nothing
    CreateAutoCADDrawing = True
    Exit Function

ErrorHandler:
    Dim msg As String
    msg = ErrText("modAutoCAD.CreateAutoCADDrawing")
    On Error Resume Next
    ' Never leave a half-built drawing open under the template's name.
    If Not doc Is Nothing Then
        If StrComp(doc.FullName, templatePath, vbTextCompare) = 0 Then doc.Close False
    End If
    Set doc = Nothing
    SetStatusBar vbNullString
    On Error GoTo 0
    RecordError r, ACT_DWG, msg, COL_DWGSTATUS, announce
End Function

'--- Bounded wait until a document reports it is no longer busy ----------------
Private Sub WaitForDocument(ByVal doc As Object)
    Dim startedAt As Double, timeoutSec As Double, ok As Boolean
    Dim probe As String
    timeoutSec = GetConfigDouble(CFG_ACADTIMEOUT, 120)
    startedAt = Timer
    Do
        On Error Resume Next
        Err.Clear
        probe = doc.Name
        ok = (Err.Number = 0)
        Err.Clear
        On Error GoTo 0
        If ok Then Exit Do
        DoEvents
        If Timer < startedAt Then startedAt = Timer
    Loop While (Timer - startedAt) < timeoutSec
    If Not ok Then Fail "modAutoCAD.WaitForDocument", "The drawing did not become ready in time."
End Sub

'==============================================================================
' Drawing metadata (title block attributes + summary information)
'==============================================================================
Public Sub PopulateDrawingMetadata(ByVal doc As Object, ByVal r As ListRow)
    Dim tokens As Object
    Dim si As Object

    Set tokens = NewDictionary()
    tokens("PART_NUMBER") = MLGetStr(r, COL_PARTNO)
    tokens("PARTNUMBER") = MLGetStr(r, COL_PARTNO)
    tokens("PART_NO") = MLGetStr(r, COL_PARTNO)
    tokens("REVISION") = MLGetStr(r, COL_REVISION)
    tokens("REV") = MLGetStr(r, COL_REVISION)
    tokens("CUSTOMER") = MLGetStr(r, COL_CUSTOMER)
    tokens("ROUTE") = MLGetStr(r, COL_ROUTE)
    tokens("DATE") = Format$(Date, "dd-mmm-yyyy")
    tokens("PREPARED_BY") = CurrentUserName()
    tokens("APPROVED_BY") = MLGetStr(r, COL_APPROVEDBY)
    tokens("COMPANY") = GetConfigValue(CFG_COMPANY, vbNullString)
    tokens("DEPARTMENT") = CurrentDepartment()
    tokens("TITLE") = MLGetStr(r, COL_PARTNO) & " Rev " & MLGetStr(r, COL_REVISION)

    ' Title-block attributes anywhere in model space or the layouts.
    FillAttributesFromTokens doc, tokens

    ' Drawing properties, so the data survives even without a title block.
    On Error Resume Next
    Set si = doc.SummaryInfo
    If Not si Is Nothing Then
        si.Title = MLGetStr(r, COL_PARTNO) & " Rev " & MLGetStr(r, COL_REVISION)
        si.Subject = "3P Process Drawing - Route " & MLGetStr(r, COL_ROUTE)
        si.Author = CurrentUserName()
        si.Keywords = MLGetStr(r, COL_CUSTOMER)
        si.Comments = SYS_NAME & " v" & GetConfigValue(CFG_SYSVERSION, SYS_VERSION)
        si.AddCustomInfo "PART_NUMBER", MLGetStr(r, COL_PARTNO)
        si.AddCustomInfo "REVISION", MLGetStr(r, COL_REVISION)
        si.AddCustomInfo "CUSTOMER", MLGetStr(r, COL_CUSTOMER)
        si.AddCustomInfo "ROUTE", MLGetStr(r, COL_ROUTE)
        si.AddCustomInfo "3P_SYSTEM", SYS_SHORT
    End If
    Err.Clear
    On Error GoTo 0
End Sub

'--- Walk every block reference and fill matching attribute tags ---------------
Private Sub FillAttributesFromTokens(ByVal doc As Object, ByVal tokens As Object)
    On Error Resume Next
    FillSpaceAttributes doc.ModelSpace, tokens
    Dim lay As Object
    For Each lay In doc.Layouts
        If UCase$(lay.Name) <> "MODEL" Then FillSpaceAttributes lay.Block, tokens
    Next lay
    Err.Clear
    On Error GoTo 0
End Sub

Private Sub FillSpaceAttributes(ByVal space As Object, ByVal tokens As Object)
    Dim ent As Object, atts As Variant, i As Long, tagName As String
    On Error Resume Next
    For Each ent In space
        If TypeNameSafe(ent) = "IAcadBlockReference" Or _
           InStr(1, TypeNameSafe(ent), "BlockRef", vbTextCompare) > 0 Then
            If ent.HasAttributes Then
                atts = ent.GetAttributes
                For i = LBound(atts) To UBound(atts)
                    tagName = UCase$(Trim$(atts(i).TagString))
                    If tokens.Exists(tagName) Then atts(i).TextString = CStr(tokens(tagName))
                Next i
            End If
        End If
    Next ent
    Err.Clear
    On Error GoTo 0
End Sub

Public Function TypeNameSafe(ByVal obj As Object) As String
    On Error Resume Next
    TypeNameSafe = TypeName(obj)
    If Err.Number <> 0 Then
        Err.Clear
        TypeNameSafe = vbNullString
    End If
    On Error GoTo 0
End Function

'==============================================================================
' Topic 114 - OpenDWGFile
'==============================================================================
Public Sub OpenDWGFile()
    Dim r As ListRow, p As String
    Dim acadApp As Object, doc As Object

    On Error GoTo ErrorHandler

    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub

    p = DwgFileFor(r)
    If Not FileExists(p) Then
        WarnBox "The drawing has not been created yet:" & vbCrLf & vbCrLf & p
        Exit Sub
    End If

    Set acadApp = GetAcadApp(True)
    Set doc = AcadDocumentIfOpen(acadApp, p)
    If doc Is Nothing Then
        Set doc = acadApp.Documents.Open(p)
    Else
        On Error Resume Next
        doc.Activate
        On Error GoTo ErrorHandler
    End If

    On Error Resume Next
    acadApp.Visible = True
    acadApp.WindowState = 3          ' acMax
    On Error GoTo 0

    LogRowAction r, "Open DWG", vbNullString, vbNullString, RES_INFO
    Exit Sub

ErrorHandler:
    ErrorBox "The drawing could not be opened in AutoCAD." & vbCrLf & vbCrLf & _
             Err.Description & vbCrLf & vbCrLf & "Opening it with the Windows shell instead."
    ShellOpen p
End Sub

'==============================================================================
' Topics 25 / 88 - MARK DWG AS EDITED
' The status is only changed on an explicit operator action, never because the
' file happens to exist.
'==============================================================================
Public Function MarkDWGAsEdited(Optional ByVal announce As Boolean = True) As Boolean
    Dim r As ListRow, p As String

    On Error GoTo ErrorHandler

    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Function

    p = DwgFileFor(r)
    If Not FileExists(p) Then
        WarnBox "The drawing does not exist yet, so it cannot be marked as edited:" & _
                vbCrLf & vbCrLf & p
        Exit Function
    End If

    If Not FileIsAccessible(p) Then
        WarnBox "The drawing is still open with unsaved changes, or is locked:" & vbCrLf & vbCrLf & _
                p & vbCrLf & vbCrLf & _
                "Save and close it in AutoCAD, then press MARK DWG AS EDITED again."
        Exit Function
    End If

    If Not AskYesNo("Mark this drawing as edited by the engineer?" & vbCrLf & vbCrLf & _
                    "Part Number : " & MLGetStr(r, COL_PARTNO) & vbCrLf & _
                    "Revision    : " & MLGetStr(r, COL_REVISION) & vbCrLf & _
                    "Drawing     : " & p) Then
        Exit Function
    End If

    MLSet r, COL_DWGPATH, p
    MLSet r, COL_DWGEDITED, Now
    UpdateDWGStatus r, ST_EDITED, ACT_DWGEDIT, RES_OK
    ClearError r

    ' A newer drawing invalidates any existing PDF and mail approval.
    ApplyChangeDetection r
    UpdateFinalStatus r
    modDashboard.RefreshDashboard

    If announce Then
        InfoBox "DWG Status = Edited" & vbCrLf & vbCrLf & _
                "Edited on " & Format$(Now, "dd-mmm-yyyy hh:nn") & " by " & CurrentUserName()
    End If

    MarkDWGAsEdited = True
    Exit Function

ErrorHandler:
    RecordError r, ACT_DWGEDIT, ErrText("modAutoCAD.MarkDWGAsEdited"), COL_DWGSTATUS, announce
End Function
