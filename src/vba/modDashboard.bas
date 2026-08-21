Attribute VB_Name = "modDashboard"
'==============================================================================
' Module      : modDashboard
' Purpose     : Everything the CONTROL_PANEL shows: the selected part panel,
'               the stage status panel, the twelve KPI cards, the search
'               results and the progress box.
'               The cell map below is the single source of truth - modBuilder
'               draws the sheet from it and this module fills it in.
'               Topics 51, 52, 53, 54, 56, 67, 68, 69.
'==============================================================================
Option Explicit

'--- Selected part panel -------------------------------------------------------
Public Const CP_PART        As String = "C7"
Public Const CP_REV         As String = "C8"
Public Const CP_CUSTOMER    As String = "C9"
Public Const CP_ROUTE       As String = "C10"
Public Const CP_APPROVAL    As String = "C11"
Public Const CP_STATUSTEXT  As String = "C12"
Public Const CP_STATE       As String = "C13"

'--- Stage status panel --------------------------------------------------------
Public Const CP_FOLDER      As String = "C16"
Public Const CP_EXCEL       As String = "C17"
Public Const CP_DWG         As String = "C18"
Public Const CP_PDF         As String = "C19"
Public Const CP_MAIL        As String = "C20"
Public Const CP_AUTO        As String = "C21"

'--- Approval flags panel ------------------------------------------------------
Public Const CP_ROUTEOK     As String = "C24"
Public Const CP_PDFOK       As String = "C25"
Public Const CP_MAILOK      As String = "C26"
Public Const CP_MAILREQ     As String = "C27"

'--- Files panel ---------------------------------------------------------------
Public Const CP_PROJPATH    As String = "C30"
Public Const CP_XLPATH      As String = "C31"
Public Const CP_DWGPATH     As String = "C32"
Public Const CP_PDFPATH     As String = "C33"

'--- Search panel --------------------------------------------------------------
Public Const CP_SEARCHFIELD As String = "F7"
Public Const CP_SEARCHTEXT  As String = "F8"
Public Const CP_RESULTTOP   As Long = 11
Public Const CP_RESULTLAST  As Long = 25
Public Const CP_RESULTCOL   As Long = 5          ' column E

'--- Progress panel ------------------------------------------------------------
Public Const CP_PROGRESS    As String = "B36"

'==============================================================================
' KPI card map (topics 52 / 68)
'==============================================================================
Public Function KpiLabels() As Variant
    KpiLabels = Array( _
        "TOTAL PARTS", "WAITING FOR ROUTE", "FOLDERS CREATED", "EXCEL CREATED", _
        "DWG CREATED", "DWG EDITED", "WAITING FOR PDF", "PDF CREATED", _
        "WAITING FOR MAIL", "MAIL SENT", "AUTOMATION COMPLETE", "ERRORS")
End Function

'--- Value cell for KPI index 0..11 (label sits one row above) -----------------
Public Function KpiValueCell(ByVal idx As Long) As String
    Dim colLetter As String, rowNo As Long
    colLetter = Mid$("EFGH", (idx Mod 4) + 1, 1)
    rowNo = 29 + (idx \ 4) * 3
    KpiValueCell = colLetter & rowNo
End Function

Public Function KpiLabelCell(ByVal idx As Long) As String
    Dim colLetter As String, rowNo As Long
    colLetter = Mid$("EFGH", (idx Mod 4) + 1, 1)
    rowNo = 28 + (idx \ 4) * 3
    KpiLabelCell = colLetter & rowNo
End Function

'==============================================================================
' Main refresh
'==============================================================================
Public Sub RefreshDashboard()
    Dim ws As Worksheet
    Dim r As ListRow
    Dim prevEvents As Boolean

    On Error GoTo Done

    Set ws = GetSheet(SH_CONTROL)
    If ws Is Nothing Then Exit Sub

    prevEvents = Application.EnableEvents
    Application.EnableEvents = False

    Set r = GetSelectedRow(False)

    RefreshSelectedPanel ws, r
    RefreshKpis ws

    Application.EnableEvents = prevEvents
    Exit Sub

Done:
    On Error Resume Next
    Application.EnableEvents = prevEvents
End Sub

Private Sub RefreshSelectedPanel(ByVal ws As Worksheet, ByVal r As ListRow)
    If r Is Nothing Then
        ws.Range(CP_CUSTOMER).Value = vbNullString
        ws.Range(CP_ROUTE).Value = vbNullString
        ws.Range(CP_APPROVAL).Value = vbNullString
        ws.Range(CP_STATUSTEXT).Value = "No part selected"
        ws.Range(CP_STATE).Value = vbNullString
        ClearCells ws, Array(CP_FOLDER, CP_EXCEL, CP_DWG, CP_PDF, CP_MAIL, CP_AUTO, _
                             CP_ROUTEOK, CP_PDFOK, CP_MAILOK, CP_MAILREQ, _
                             CP_PROJPATH, CP_XLPATH, CP_DWGPATH, CP_PDFPATH)
        Exit Sub
    End If

    ws.Range(CP_CUSTOMER).Value = MLGetStr(r, COL_CUSTOMER)
    ws.Range(CP_ROUTE).Value = MLGetStr(r, COL_ROUTE)
    ws.Range(CP_APPROVAL).Value = MLGetStr(r, COL_APPROVALSTATUS) & _
                                  IIf(Len(MLGetStr(r, COL_APPROVEDBY)) > 0, _
                                      " (" & MLGetStr(r, COL_APPROVEDBY) & ")", vbNullString)
    ws.Range(CP_STATUSTEXT).Value = CurrentStatusText(r)
    ws.Range(CP_STATE).Value = StateName(GetPartState(r))

    WriteStatusCell ws, CP_FOLDER, MLGetStr(r, COL_FOLDERSTATUS)
    WriteStatusCell ws, CP_EXCEL, MLGetStr(r, COL_EXCELSTATUS)
    WriteStatusCell ws, CP_DWG, MLGetStr(r, COL_DWGSTATUS)
    WriteStatusCell ws, CP_PDF, MLGetStr(r, COL_PDFSTATUS)
    WriteStatusCell ws, CP_MAIL, MLGetStr(r, COL_MAILSTATUS)
    WriteStatusCell ws, CP_AUTO, MLGetStr(r, COL_AUTOSTATUS)

    WriteFlagCell ws, CP_ROUTEOK, MLGetStr(r, COL_ROUTEOK)
    WriteFlagCell ws, CP_PDFOK, MLGetStr(r, COL_PDFOK)
    WriteFlagCell ws, CP_MAILOK, MLGetStr(r, COL_MAILOK)
    WriteFlagCell ws, CP_MAILREQ, MLGetStr(r, COL_MAILREQUIRED)

    WritePathCell ws, CP_PROJPATH, ProjectPathFor(r), FolderExists(ProjectPathFor(r))
    WritePathCell ws, CP_XLPATH, ExcelFileFor(r), FileExists(ExcelFileFor(r))
    WritePathCell ws, CP_DWGPATH, DwgFileFor(r), FileExists(DwgFileFor(r))
    WritePathCell ws, CP_PDFPATH, PdfFileFor(r), FileExists(PdfFileFor(r))
End Sub

Private Sub ClearCells(ByVal ws As Worksheet, ByVal addresses As Variant)
    Dim i As Long
    For i = LBound(addresses) To UBound(addresses)
        ws.Range(CStr(addresses(i))).Value = vbNullString
    Next i
End Sub

Private Sub WriteStatusCell(ByVal ws As Worksheet, ByVal addr As String, ByVal statusValue As String)
    With ws.Range(addr)
        .Value = IIf(Len(statusValue) = 0, ST_NOTSTARTED, statusValue)
        .Font.Bold = True
        Select Case statusValue
            Case ST_CREATED, ST_SENT, ST_COMPLETE, ST_EDITED
                .Font.Color = RGB(0, 110, 60)
            Case ST_WAITING, ST_READY, ST_RUNNING
                .Font.Color = RGB(180, 100, 0)
            Case ST_ERROR
                .Font.Color = RGB(190, 30, 30)
            Case ST_SKIPPED
                .Font.Color = RGB(110, 110, 110)
            Case Else
                .Font.Color = RGB(70, 70, 70)
        End Select
    End With
End Sub

Private Sub WriteFlagCell(ByVal ws As Worksheet, ByVal addr As String, ByVal flagValue As String)
    With ws.Range(addr)
        .Value = IIf(Len(flagValue) = 0, NO_, UCase$(flagValue))
        .Font.Bold = True
        If UCase$(flagValue) = YES_ Then
            .Font.Color = RGB(0, 110, 60)
        Else
            .Font.Color = RGB(150, 90, 0)
        End If
    End With
End Sub

Private Sub WritePathCell(ByVal ws As Worksheet, ByVal addr As String, ByVal pathValue As String, _
                          ByVal exists As Boolean)
    With ws.Range(addr)
        .Value = pathValue
        .Font.Bold = False
        If exists Then
            .Font.Color = RGB(0, 110, 60)
        Else
            .Font.Color = RGB(150, 150, 150)
        End If
    End With
End Sub

'==============================================================================
' Topics 52 / 68 - KPI counters, computed in VBA over tblMaster
'==============================================================================
Public Sub RefreshKpis(Optional ByVal ws As Worksheet = Nothing)
    Dim lo As ListObject, r As ListRow
    Dim total As Long, waitRoute As Long, folders As Long, excels As Long
    Dim dwgs As Long, edited As Long, waitPdf As Long, pdfs As Long
    Dim waitMail As Long, mailSent As Long, complete As Long, errors As Long
    Dim i As Long, values As Variant

    If ws Is Nothing Then Set ws = GetSheet(SH_CONTROL)
    If ws Is Nothing Then Exit Sub
    If Not TableExists(SH_MASTER, TBL_MASTER) Then Exit Sub

    Set lo = MasterTable()
    For Each r In lo.ListRows
        If Len(MLGetStr(r, COL_PARTNO)) > 0 Then
            total = total + 1
            If Not IsYes(MLGet(r, COL_ROUTEOK)) Then waitRoute = waitRoute + 1
            If MLGetStr(r, COL_FOLDERSTATUS) = ST_CREATED Then folders = folders + 1
            If MLGetStr(r, COL_EXCELSTATUS) = ST_CREATED Then excels = excels + 1
            Select Case MLGetStr(r, COL_DWGSTATUS)
                Case ST_CREATED: dwgs = dwgs + 1
                Case ST_EDITED:  dwgs = dwgs + 1: edited = edited + 1
            End Select
            If MLGetStr(r, COL_PDFSTATUS) = ST_CREATED Then
                pdfs = pdfs + 1
            ElseIf Not IsYes(MLGet(r, COL_PDFOK)) And _
                   (MLGetStr(r, COL_DWGSTATUS) = ST_CREATED Or MLGetStr(r, COL_DWGSTATUS) = ST_EDITED) Then
                waitPdf = waitPdf + 1
            End If
            Select Case MLGetStr(r, COL_MAILSTATUS)
                Case ST_SENT: mailSent = mailSent + 1
                Case ST_WAITING, ST_READY: waitMail = waitMail + 1
            End Select
            If MLGetStr(r, COL_AUTOSTATUS) = ST_COMPLETE Then complete = complete + 1
            If UCase$(MLGetStr(r, COL_ERRORSTATUS)) = "ERROR" _
               Or MLGetStr(r, COL_AUTOSTATUS) = ST_ERROR Then errors = errors + 1
        End If
    Next r

    values = Array(total, waitRoute, folders, excels, dwgs, edited, _
                   waitPdf, pdfs, waitMail, mailSent, complete, errors)

    For i = 0 To 11
        ws.Range(KpiValueCell(i)).Value = values(i)
    Next i

    ' The error card turns red when anything needs attention.
    With ws.Range(KpiValueCell(11))
        If errors > 0 Then
            .Font.Color = RGB(190, 30, 30)
        Else
            .Font.Color = RGB(0, 110, 60)
        End If
    End With
End Sub

'==============================================================================
' Topics 54 / 69 - search
'==============================================================================
Public Sub RunSearch()
    Dim ws As Worksheet
    Dim hits As Collection, i As Long, r As ListRow
    Dim fieldName As String, searchText As String
    Dim rowNo As Long

    On Error GoTo ErrorHandler

    Set ws = RequireSheet(SH_CONTROL)
    fieldName = NzTrim(ws.Range(CP_SEARCHFIELD).Value)
    searchText = NzTrim(ws.Range(CP_SEARCHTEXT).Value)

    ClearSearchResults ws

    If Len(searchText) = 0 Then
        WarnBox "Type something to search for first."
        Exit Sub
    End If

    Set hits = SearchParts(fieldName, searchText)

    If hits.Count = 0 Then
        ws.Cells(CP_RESULTTOP, CP_RESULTCOL).Value = "No match for '" & searchText & "'"
        Exit Sub
    End If

    rowNo = CP_RESULTTOP
    For i = 1 To hits.Count
        If rowNo > CP_RESULTLAST Then
            ws.Cells(rowNo, CP_RESULTCOL).Value = "... " & (hits.Count - (rowNo - CP_RESULTTOP)) & _
                                                  " more match(es) not shown"
            Exit For
        End If
        Set r = hits(i)
        ws.Cells(rowNo, CP_RESULTCOL).Value = MLGetStr(r, COL_PARTNO)
        ws.Cells(rowNo, CP_RESULTCOL + 1).Value = MLGetStr(r, COL_REVISION)
        ws.Cells(rowNo, CP_RESULTCOL + 2).Value = MLGetStr(r, COL_CUSTOMER)
        ws.Cells(rowNo, CP_RESULTCOL + 3).Value = MLGetStr(r, COL_ROUTE)
        rowNo = rowNo + 1
    Next i

    ' A single hit selects itself immediately.
    If hits.Count = 1 Then
        Set r = hits(1)
        SetSelectedPart MLGetStr(r, COL_PARTNO), MLGetStr(r, COL_REVISION)
        RefreshDashboard
    Else
        InfoBox hits.Count & " match(es) found." & vbCrLf & vbCrLf & _
                "Click a row in the results list, then press SELECT PART."
    End If
    Exit Sub

ErrorHandler:
    ErrorBox ErrText("modDashboard.RunSearch")
End Sub

Public Sub ClearSearchResults(Optional ByVal ws As Worksheet = Nothing)
    If ws Is Nothing Then Set ws = GetSheet(SH_CONTROL)
    If ws Is Nothing Then Exit Sub
    ws.Range(ws.Cells(CP_RESULTTOP, CP_RESULTCOL), _
             ws.Cells(CP_RESULTLAST + 1, CP_RESULTCOL + 3)).ClearContents
End Sub

'--- Topic 70 - make the highlighted search result the active part -------------
Public Sub SelectPartFromSearchResults()
    Dim ws As Worksheet, rowNo As Long
    Dim pn As String, rev As String

    Set ws = RequireSheet(SH_CONTROL)
    rowNo = Selection.Row

    If Selection.Column < CP_RESULTCOL Or Selection.Column > CP_RESULTCOL + 3 _
       Or rowNo < CP_RESULTTOP Or rowNo > CP_RESULTLAST Then
        WarnBox "Click one of the search result rows first, then press SELECT PART."
        Exit Sub
    End If

    pn = NzTrim(ws.Cells(rowNo, CP_RESULTCOL).Value)
    rev = NzTrim(ws.Cells(rowNo, CP_RESULTCOL + 1).Value)
    If Len(pn) = 0 Then
        WarnBox "That result row is empty."
        Exit Sub
    End If

    SetSelectedPart pn, rev
    RefreshDashboard
End Sub

'--- Selecting straight from MASTER_LIST (used by the sheet event) -------------
Public Sub SelectPartFromMasterRow(ByVal targetRow As Long)
    Dim lo As ListObject, idx As Long, r As ListRow
    Set lo = MasterTable()
    idx = targetRow - lo.HeaderRowRange.Row
    If idx < 1 Or idx > lo.ListRows.Count Then Exit Sub
    Set r = lo.ListRows(idx)
    SetSelectedPart MLGetStr(r, COL_PARTNO), MLGetStr(r, COL_REVISION)
    RefreshDashboard
End Sub

'==============================================================================
' Topic 56 - progress box
'==============================================================================
Public Sub WriteProgress(ByVal bodyText As String)
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = GetSheet(SH_CONTROL)
    If ws Is Nothing Then Exit Sub
    ws.Range(CP_PROGRESS).Value = bodyText
    On Error GoTo 0
End Sub

Public Sub ClearProgress()
    WriteProgress vbNullString
End Sub
