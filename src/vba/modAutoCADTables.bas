Attribute VB_Name = "modAutoCADTables"
'==============================================================================
' Module      : modAutoCADTables
' Purpose     : Topic 23 - one AutoCAD table per process, filled from that
'               process's sheet in "<Part Number>.xlsx".
'               The table title carries the unique process identifier
'               (Part Number + Revision + Process Code) so a table can never be
'               associated with the wrong process.
'==============================================================================
Option Explicit

Private Const PARAM_HEADER_ROW As Long = 18      ' matches modProcessExcel layout
Private Const PARAM_FIRST_ROW  As Long = 19
Private Const PARAM_LAST_ROW   As Long = 30

'==============================================================================
' Topic 114 - UpdateAutoCADTables
'==============================================================================
Public Sub UpdateAutoCADTables(ByVal doc As Object, ByVal r As ListRow, ByVal steps_ As Collection)
    Dim wb As Workbook
    Dim alreadyOpen As Boolean
    Dim excelPath As String
    Dim i As Long, s As clsProcessStep
    Dim data As Variant

    On Error GoTo Cleanup

    excelPath = ExcelFileFor(r)
    If Not FileExists(excelPath) Then
        Fail "modAutoCADTables.UpdateAutoCADTables", _
             "The process Excel file is missing, so the drawing tables cannot be linked:" & _
             vbCrLf & excelPath
    End If

    Set wb = WorkbookIfOpen(excelPath)
    If wb Is Nothing Then
        Set wb = Application.Workbooks.Open(excelPath, UpdateLinks:=0, ReadOnly:=True)
    Else
        alreadyOpen = True
    End If

    For i = 1 To steps_.Count
        Set s = steps_(i)
        data = ReadProcessRows(wb, s)
        BuildProcessTable doc, r, s, data
    Next i

Cleanup:
    Dim keptErr As String
    If Err.Number <> 0 Then keptErr = ErrText("modAutoCADTables.UpdateAutoCADTables")
    On Error Resume Next
    If Not wb Is Nothing And Not alreadyOpen Then wb.Close SaveChanges:=False
    On Error GoTo 0
    If Len(keptErr) > 0 Then Err.Raise vbObjectError + 2100, "modAutoCADTables", keptErr
End Sub

'==============================================================================
' Read the parameter rows of one process sheet.
' Returns a 2-D array (1..n, 1..5): Sr / Parameter / Specification / Unit / Remarks
'==============================================================================
Private Function ReadProcessRows(ByVal wb As Workbook, ByVal s As clsProcessStep) As Variant
    Dim ws As Worksheet
    Dim rowIdx As Long, n As Long
    Dim result() As String

    On Error Resume Next
    Set ws = wb.Worksheets(SafeSheetName(s.SheetName))
    On Error GoTo 0

    If ws Is Nothing Then
        ReadProcessRows = Empty
        Exit Function
    End If

    ReDim result(1 To PARAM_LAST_ROW - PARAM_FIRST_ROW + 1, 1 To 5)
    For rowIdx = PARAM_FIRST_ROW To PARAM_LAST_ROW
        ' Skip rows where nothing has been filled in yet.
        If Len(NzTrim(ws.Cells(rowIdx, 2).Value)) > 0 _
           Or Len(NzTrim(ws.Cells(rowIdx, 3).Value)) > 0 Then
            n = n + 1
            result(n, 1) = NzTrim(ws.Cells(rowIdx, 1).Value)
            result(n, 2) = NzTrim(ws.Cells(rowIdx, 2).Value)
            result(n, 3) = NzTrim(ws.Cells(rowIdx, 3).Value)
            result(n, 4) = NzTrim(ws.Cells(rowIdx, 4).Value)
            result(n, 5) = NzTrim(ws.Cells(rowIdx, 8).Value)
        End If
    Next rowIdx

    If n = 0 Then
        ReadProcessRows = Empty
    Else
        Dim trimmed() As String, i As Long, j As Long
        ReDim trimmed(1 To n, 1 To 5)
        For i = 1 To n
            For j = 1 To 5
                trimmed(i, j) = result(i, j)
            Next j
        Next i
        ReadProcessRows = trimmed
    End If
End Function

'==============================================================================
' Build (or rebuild) the AutoCAD table for one process step
'==============================================================================
Private Sub BuildProcessTable(ByVal doc As Object, ByVal r As ListRow, _
                              ByVal s As clsProcessStep, ByVal data As Variant)
    Dim tbl As Object
    Dim insPoint(0 To 2) As Double
    Dim uid As String
    Dim dataRows As Long, totalRows As Long
    Dim rowH As Double, colW As Double, textH As Double, yOffset As Double
    Dim i As Long, spacing As Double

    uid = ProcessUID(r, s.Code)
    rowH = GetConfigDouble(CFG_TABLEROWH, 8)
    colW = GetConfigDouble(CFG_TABLECOLW, 30)
    textH = GetConfigDouble(CFG_TABLETEXTH, 2.5)
    yOffset = GetConfigDouble(CFG_TABLEOFFSET, 40)
    spacing = GetConfigDouble(CFG_SPACING, 150)

    If IsEmpty(data) Then
        dataRows = 1                                   ' one placeholder row
    Else
        dataRows = UBound(data, 1)
    End If

    ' title + header + data
    totalRows = dataRows + 2

    insPoint(0) = s.EffectiveX(spacing)
    insPoint(1) = s.Y - yOffset
    insPoint(2) = 0#

    ' Remove any earlier table for this exact process before adding a new one.
    RemoveTableByTitle doc, uid

    On Error GoTo TableFailed
    Set tbl = doc.ModelSpace.AddTable(insPoint, totalRows, 5, rowH, colW)

    On Error Resume Next
    tbl.RegenerateTableSuppressed = True

    tbl.SetColumnWidth 0, colW * 0.25
    tbl.SetColumnWidth 1, colW * 1.2
    tbl.SetColumnWidth 2, colW
    tbl.SetColumnWidth 3, colW * 0.5
    tbl.SetColumnWidth 4, colW

    ' Row 0 = title carrying the unique process identifier (topic 23)
    tbl.SetText 0, 0, uid & "  |  " & s.Code & " - " & s.Name & "  |  Step " & s.Sequence

    ' Row 1 = header
    tbl.SetText 1, 0, "Sr."
    tbl.SetText 1, 1, "Operation / Parameter"
    tbl.SetText 1, 2, "Specification"
    tbl.SetText 1, 3, "Unit"
    tbl.SetText 1, 4, "Remarks"

    If IsEmpty(data) Then
        tbl.SetText 2, 0, "1"
        tbl.SetText 2, 1, "See " & s.SheetName & " sheet of " & SafePartName(r) & ".xlsx"
        tbl.SetText 2, 2, s.Description
        tbl.SetText 2, 3, vbNullString
        tbl.SetText 2, 4, vbNullString
    Else
        For i = 1 To dataRows
            tbl.SetText i + 1, 0, data(i, 1)
            tbl.SetText i + 1, 1, data(i, 2)
            tbl.SetText i + 1, 2, data(i, 3)
            tbl.SetText i + 1, 3, data(i, 4)
            tbl.SetText i + 1, 4, data(i, 5)
        Next i
    End If

    For i = 0 To totalRows - 1
        tbl.SetRowHeight i, rowH
    Next i

    tbl.RegenerateTableSuppressed = False
    Err.Clear
    On Error GoTo 0
    Exit Sub

TableFailed:
    ' AcadTable is unavailable (very unusual). Fall back to MText so the drawing
    ' still carries the process data, and record why in the log.
    Err.Clear
    On Error Resume Next
    Dim txt As Object, body As String
    body = uid & "\P" & s.Code & " - " & s.Name & " (step " & s.Sequence & ")\P" & _
           "Excel sheet: " & s.SheetName
    Set txt = doc.ModelSpace.AddMText(insPoint, colW * 3, body)
    If Not txt Is Nothing Then txt.Height = textH
    LogRowAction r, ACT_DWG, vbNullString, vbNullString, RES_INFO, _
                 "AcadTable unavailable for " & uid & " - MText fallback used."
    Err.Clear
    On Error GoTo 0
End Sub

'--- Delete a table whose title cell matches the given identifier ---------------
Private Sub RemoveTableByTitle(ByVal doc As Object, ByVal uid As String)
    Dim ent As Object, title As String
    On Error Resume Next
    For Each ent In doc.ModelSpace
        If InStr(1, TypeNameSafe(ent), "Table", vbTextCompare) > 0 Then
            title = ent.GetText(0, 0)
            If Err.Number = 0 Then
                If InStr(1, title, uid, vbTextCompare) > 0 Then ent.Delete
            End If
            Err.Clear
        End If
    Next ent
    Err.Clear
    On Error GoTo 0
End Sub

'==============================================================================
' Verification helper - confirms every route process has a table in the drawing
'==============================================================================
Public Function ProcessTablesPresent(ByVal doc As Object, ByVal r As ListRow, _
                                     ByVal steps_ As Collection) As Boolean
    Dim i As Long, found As Boolean, ent As Object, uid As String
    Dim allFound As Boolean

    allFound = True
    For i = 1 To steps_.Count
        uid = ProcessUID(r, steps_(i).Code)
        found = False
        On Error Resume Next
        For Each ent In doc.ModelSpace
            If InStr(1, TypeNameSafe(ent), "Table", vbTextCompare) > 0 Then
                If InStr(1, ent.GetText(0, 0), uid, vbTextCompare) > 0 Then
                    found = True
                    Exit For
                End If
            End If
            Err.Clear
        Next ent
        On Error GoTo 0
        If Not found Then allFound = False
    Next i

    ProcessTablesPresent = allFound
End Function
