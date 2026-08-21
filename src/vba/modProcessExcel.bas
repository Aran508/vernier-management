Attribute VB_Name = "modProcessExcel"
'==============================================================================
' Module      : modProcessExcel
' Purpose     : Stage 4 - build "<Part Number>.xlsx" in the part's Excel folder
'               with one professionally formatted sheet per route step, in
'               route order. Existing files are verified and reused, never
'               duplicated. Topics 13, 14, 15, 16, 99, 100.
'==============================================================================
Option Explicit

Private Const HDR_BLUE As Long = 6567967        ' RGB(31, 56, 100)
Private Const LBL_GREY As Long = 15132390       ' RGB(230, 230, 230)

'==============================================================================
' Topic 114 - CreateProcessExcel
'==============================================================================
Public Function CreateProcessExcel(ByVal r As ListRow, _
                                   Optional ByVal announce As Boolean = False) As Boolean
    Dim wb As Workbook
    Dim targetPath As String
    Dim steps_ As Collection
    Dim i As Long
    Dim reused As Boolean
    Dim prevAlerts As Boolean

    prevAlerts = Application.DisplayAlerts
    On Error GoTo ErrorHandler

    If r Is Nothing Then Exit Function

    If MLGetStr(r, COL_FOLDERSTATUS) <> ST_CREATED Then
        Fail "modProcessExcel.CreateProcessExcel", _
             "The folder structure is not ready. Create the folders first."
    End If

    Set steps_ = RouteProcessDefs(r)
    If steps_.Count = 0 Then
        Fail "modProcessExcel.CreateProcessExcel", _
             "The route produced no process steps - validate the route first."
    End If

    targetPath = ExcelFileFor(r)
    SetStatusBar "Building process Excel for " & MLGetStr(r, COL_PARTNO) & " ..."

    Application.DisplayAlerts = False

    If FileExists(targetPath) Then
        ' Topic 100 - verify and reuse. Never create "(1)" copies.
        If Not FileIsAccessible(targetPath) Then
            Fail "modProcessExcel.CreateProcessExcel", _
                 "The process Excel file is open in another application:" & vbCrLf & targetPath
        End If
        Set wb = Application.Workbooks.Open(targetPath, UpdateLinks:=0)
        reused = True
    Else
        Set wb = Application.Workbooks.Add(xlWBATWorksheet)
    End If

    ' Create / refresh one sheet per route step, in exact route order.
    For i = 1 To steps_.Count
        BuildProcessSheet wb, r, steps_(i), i
    Next i

    RemoveNonRouteSheets wb, steps_, reused
    OrderSheets wb, steps_

    wb.Worksheets(1).Activate
    wb.Worksheets(1).Range("A1").Select

    If reused Then
        wb.Save
    Else
        wb.SaveAs Filename:=targetPath, FileFormat:=xlOpenXMLWorkbook
    End If
    wb.Close SaveChanges:=False
    Set wb = Nothing

    Application.DisplayAlerts = prevAlerts

    If Not FileExists(targetPath) Then
        Fail "modProcessExcel.CreateProcessExcel", _
             "The process Excel file was not found after saving:" & vbCrLf & targetPath
    End If

    MLSet r, COL_EXCELPATH, targetPath
    MLSetIfBlank r, COL_XLCREATED, Now
    ClearError r
    UpdateExcelStatus r, ST_CREATED, ACT_EXCEL, RES_OK
    SetStatusBar vbNullString

    If announce Then
        InfoBox IIf(reused, "Existing process Excel verified and updated:", _
                            "Process Excel created:") & vbCrLf & vbCrLf & targetPath & _
                vbCrLf & vbCrLf & "Sheets: " & StepCodes(steps_)
    End If

    CreateProcessExcel = True
    Exit Function

ErrorHandler:
    On Error Resume Next
    If Not wb Is Nothing Then wb.Close SaveChanges:=False
    Application.DisplayAlerts = prevAlerts
    SetStatusBar vbNullString
    On Error GoTo 0
    RecordError r, ACT_EXCEL, ErrText("modProcessExcel.CreateProcessExcel"), COL_EXCELSTATUS, announce
End Function

'==============================================================================
' Topic 15 - one professional process sheet
'==============================================================================
Private Sub BuildProcessSheet(ByVal wb As Workbook, ByVal r As ListRow, _
                              ByVal stepDef As clsProcessStep, ByVal seqNo As Long)
    Dim ws As Worksheet
    Dim isNew As Boolean
    Dim tableTop As Long, i As Long

    Set ws = SheetByName(wb, stepDef.SheetName)
    If ws Is Nothing Then
        Set ws = wb.Worksheets.Add(After:=wb.Worksheets(wb.Worksheets.Count))
        ws.Name = SafeSheetName(stepDef.SheetName)
        isNew = True
    End If

    With ws
        .Cells.Font.Name = "Calibri"
        .Cells.Font.Size = 11

        '--- Title band ---
        .Range("A1:H1").Merge
        .Range("A1").Value = GetConfigValue(CFG_COMPANY, "COMPANY NAME")
        .Range("A1").Font.Size = 16
        .Range("A1").Font.Bold = True
        .Range("A1").Font.Color = vbWhite
        .Range("A1:H1").Interior.Color = HDR_BLUE
        .Range("A1").HorizontalAlignment = xlCenter
        .Rows(1).RowHeight = 26

        .Range("A2:H2").Merge
        .Range("A2").Value = "3P PROCESS SHEET  -  " & UCase$(stepDef.Name)
        .Range("A2").Font.Size = 13
        .Range("A2").Font.Bold = True
        .Range("A2").HorizontalAlignment = xlCenter
        .Range("A2:H2").Interior.Color = LBL_GREY
        .Rows(2).RowHeight = 20

        .Range("A3:H3").Merge
        .Range("A3").Value = CurrentDepartment() & _
                             "   |   " & SYS_SHORT & " v" & GetConfigValue(CFG_SYSVERSION, SYS_VERSION)
        .Range("A3").HorizontalAlignment = xlCenter
        .Range("A3").Font.Italic = True

        '--- Header block (topic 15 fields) ---
        WriteField ws, "A5", "Part Number", "B5", MLGetStr(r, COL_PARTNO)
        WriteField ws, "A6", "Revision", "B6", MLGetStr(r, COL_REVISION)
        WriteField ws, "A7", "Customer", "B7", MLGetStr(r, COL_CUSTOMER)
        WriteField ws, "A8", "Route", "B8", MLGetStr(r, COL_ROUTE)
        WriteField ws, "A9", "Process ID", "B9", ProcessUID(r, stepDef.Code)

        WriteField ws, "E5", "Process Code", "F5", stepDef.Code
        WriteField ws, "E6", "Process Name", "F6", stepDef.Name
        WriteField ws, "E7", "Process Sequence", "F7", CStr(seqNo) & " of " & _
                                                       CStr(RouteStepCount(MLGetStr(r, COL_ROUTE)))
        WriteField ws, "E8", "Date", "F8", Format$(Date, "dd-mmm-yyyy")
        WriteField ws, "E9", "Prepared By", "F9", CurrentUserName()
        WriteField ws, "E10", "Approved By", "F10", MLGetStr(r, COL_APPROVEDBY)
        WriteField ws, "A10", "Process Owner", "B10", stepDef.Owner

        '--- Process description ---
        .Range("A12").Value = "PROCESS DESCRIPTION"
        SectionHeader .Range("A12:H12")
        If isNew Or Len(NzTrim(.Range("A13").Value)) = 0 Then
            .Range("A13:H15").Merge
            .Range("A13").Value = stepDef.Description
        End If
        .Range("A13").HorizontalAlignment = xlLeft
        .Range("A13").VerticalAlignment = xlTop
        .Range("A13").WrapText = True
        .Range("A13:H15").Borders.LineStyle = xlContinuous

        '--- Process parameters table ---
        tableTop = 17
        .Cells(tableTop, 1).Value = "PROCESS PARAMETERS"
        SectionHeader .Range(.Cells(tableTop, 1), .Cells(tableTop, 8))

        .Cells(tableTop + 1, 1).Value = "Sr."
        .Cells(tableTop + 1, 2).Value = "Operation / Parameter"
        .Cells(tableTop + 1, 3).Value = "Specification"
        .Cells(tableTop + 1, 4).Value = "Unit"
        .Cells(tableTop + 1, 5).Value = "Tolerance"
        .Cells(tableTop + 1, 6).Value = "Machine / Tool"
        .Cells(tableTop + 1, 7).Value = "Inspection Method"
        .Cells(tableTop + 1, 8).Value = "Remarks"
        With .Range(.Cells(tableTop + 1, 1), .Cells(tableTop + 1, 8))
            .Font.Bold = True
            .Interior.Color = LBL_GREY
            .HorizontalAlignment = xlCenter
            .Borders.LineStyle = xlContinuous
        End With

        If isNew Then
            For i = 1 To 12
                .Cells(tableTop + 1 + i, 1).Value = i
            Next i
        End If
        With .Range(.Cells(tableTop + 2, 1), .Cells(tableTop + 13, 8))
            .Borders.LineStyle = xlContinuous
            .VerticalAlignment = xlCenter
        End With
        .Range(.Cells(tableTop + 2, 1), .Cells(tableTop + 13, 1)).HorizontalAlignment = xlCenter

        '--- Remarks ---
        .Cells(tableTop + 15, 1).Value = "REMARKS"
        SectionHeader .Range(.Cells(tableTop + 15, 1), .Cells(tableTop + 15, 8))
        If isNew Then
            .Range(.Cells(tableTop + 16, 1), .Cells(tableTop + 18, 8)).Merge
        End If
        .Cells(tableTop + 16, 1).WrapText = True
        .Cells(tableTop + 16, 1).VerticalAlignment = xlTop
        .Range(.Cells(tableTop + 16, 1), .Cells(tableTop + 18, 8)).Borders.LineStyle = xlContinuous

        '--- Sign-off strip ---
        .Cells(tableTop + 20, 1).Value = "Prepared By"
        .Cells(tableTop + 20, 3).Value = "Checked By"
        .Cells(tableTop + 20, 5).Value = "Approved By"
        .Cells(tableTop + 20, 7).Value = "Date"
        With .Range(.Cells(tableTop + 20, 1), .Cells(tableTop + 20, 8))
            .Font.Bold = True
        End With
        .Range(.Cells(tableTop + 21, 1), .Cells(tableTop + 21, 8)).Borders(xlEdgeBottom).LineStyle = xlContinuous

        '--- Column widths / page setup ---
        .Columns("A").ColumnWidth = 16
        .Columns("B").ColumnWidth = 26
        .Columns("C").ColumnWidth = 18
        .Columns("D").ColumnWidth = 10
        .Columns("E").ColumnWidth = 16
        .Columns("F").ColumnWidth = 22
        .Columns("G").ColumnWidth = 20
        .Columns("H").ColumnWidth = 24

        On Error Resume Next
        With .PageSetup
            .Orientation = xlLandscape
            .Zoom = False
            .FitToPagesWide = 1
            .FitToPagesTall = 1
            .CenterHorizontally = True
            .LeftHeader = "&""Calibri,Bold""" & MLGetStr(r, COL_PARTNO) & " Rev " & MLGetStr(r, COL_REVISION)
            .RightHeader = stepDef.Code & " - " & stepDef.Name
            .LeftFooter = SYS_SHORT
            .RightFooter = "Page &P of &N"
        End With
        On Error GoTo 0

        .Range("A1").Select
    End With
End Sub

Private Sub WriteField(ByVal ws As Worksheet, ByVal labelCell As String, ByVal labelText As String, _
                       ByVal valueCell As String, ByVal valueText As String)
    With ws.Range(labelCell)
        .Value = labelText
        .Font.Bold = True
        .Interior.Color = LBL_GREY
        .Borders.LineStyle = xlContinuous
    End With
    With ws.Range(valueCell)
        .Value = valueText
        .Borders.LineStyle = xlContinuous
    End With
End Sub

Private Sub SectionHeader(ByVal rng As Range)
    With rng
        .Merge
        .Font.Bold = True
        .Font.Color = vbWhite
        .Interior.Color = HDR_BLUE
        .HorizontalAlignment = xlLeft
        .IndentLevel = 1
    End With
End Sub

'--- Helpers -------------------------------------------------------------------
Private Function SheetByName(ByVal wb As Workbook, ByVal sheetName As String) As Worksheet
    On Error Resume Next
    Set SheetByName = wb.Worksheets(SafeSheetName(sheetName))
    On Error GoTo 0
End Function

Public Function SafeSheetName(ByVal rawName As String) As String
    Dim s As String, bad As Variant, i As Long
    s = Trim$(rawName)
    bad = Array("\", "/", "?", "*", "[", "]", ":")
    For i = LBound(bad) To UBound(bad)
        s = Replace$(s, CStr(bad(i)), "_")
    Next i
    If Len(s) > 31 Then s = Left$(s, 31)
    If Len(s) = 0 Then s = "SHEET"
    SafeSheetName = s
End Function

'--- Remove the default "Sheet1" from a brand-new workbook only. Sheets that an
'    engineer added by hand to an existing file are left untouched.
Private Sub RemoveNonRouteSheets(ByVal wb As Workbook, ByVal steps_ As Collection, _
                                 ByVal reused As Boolean)
    Dim ws As Worksheet, keep As Object, i As Long
    If reused Then Exit Sub

    Set keep = NewDictionary()
    For i = 1 To steps_.Count
        keep(SafeSheetName(steps_(i).SheetName)) = 1
    Next i

    For i = wb.Worksheets.Count To 1 Step -1
        Set ws = wb.Worksheets(i)
        If Not keep.Exists(ws.Name) Then
            If wb.Worksheets.Count > 1 Then ws.Delete
        End If
    Next i
End Sub

'--- Put the route sheets back into route order --------------------------------
Private Sub OrderSheets(ByVal wb As Workbook, ByVal steps_ As Collection)
    Dim i As Long, ws As Worksheet
    On Error Resume Next
    For i = 1 To steps_.Count
        Set ws = wb.Worksheets(SafeSheetName(steps_(i).SheetName))
        If Not ws Is Nothing Then
            If i = 1 Then
                ws.Move Before:=wb.Worksheets(1)
            Else
                ws.Move After:=wb.Worksheets(SafeSheetName(steps_(i - 1).SheetName))
            End If
        End If
        Set ws = Nothing
    Next i
    On Error GoTo 0
End Sub

Private Function StepCodes(ByVal steps_ As Collection) As String
    Dim i As Long, s As String
    For i = 1 To steps_.Count
        If Len(s) > 0 Then s = s & " - "
        s = s & steps_(i).Code
    Next i
    StepCodes = s
End Function

'==============================================================================
' Read a value back out of a generated process sheet. Used by modAutoCADTables
' so that the DWG table and the Excel sheet can never disagree.
'==============================================================================
Public Function ReadProcessSheetValue(ByVal excelPath As String, ByVal sheetName As String, _
                                      ByVal cellAddress As String) As String
    Dim wb As Workbook, ws As Worksheet
    Dim alreadyOpen As Boolean

    On Error GoTo Cleanup
    If Not FileExists(excelPath) Then Exit Function

    Set wb = WorkbookIfOpen(excelPath)
    If wb Is Nothing Then
        Set wb = Application.Workbooks.Open(excelPath, UpdateLinks:=0, ReadOnly:=True)
    Else
        alreadyOpen = True
    End If

    On Error Resume Next
    Set ws = wb.Worksheets(SafeSheetName(sheetName))
    On Error GoTo Cleanup
    If Not ws Is Nothing Then ReadProcessSheetValue = NzTrim(ws.Range(cellAddress).Value)

Cleanup:
    On Error Resume Next
    If Not wb Is Nothing And Not alreadyOpen Then wb.Close SaveChanges:=False
    On Error GoTo 0
End Function

Public Function WorkbookIfOpen(ByVal fullPath As String) As Workbook
    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If StrComp(wb.FullName, fullPath, vbTextCompare) = 0 Then
            Set WorkbookIfOpen = wb
            Exit Function
        End If
    Next wb
End Function

'--- Topic 114 - OpenProcessExcel ----------------------------------------------
Public Sub OpenProcessExcel()
    Dim r As ListRow, p As String
    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub
    p = ExcelFileFor(r)
    If Not FileExists(p) Then
        WarnBox "The process Excel file has not been created yet:" & vbCrLf & vbCrLf & p
        Exit Sub
    End If
    Application.Workbooks.Open p
End Sub
