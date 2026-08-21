Attribute VB_Name = "modMasterList"
'==============================================================================
' Module      : modMasterList
' Purpose     : Every read/write against tblMaster. Columns are addressed by
'               header name only, so the sheet can be re-ordered without
'               breaking the code. Topics 5, 70, 71, 93.
'==============================================================================
Option Explicit

Private mColIndex As Object          ' header (upper) -> column index cache

'==============================================================================
' Table access
'==============================================================================
Public Function MasterTable() As ListObject
    Set MasterTable = RequireTable(SH_MASTER, TBL_MASTER)
End Function

Public Sub ClearColumnCache()
    Set mColIndex = Nothing
End Sub

Private Function ColIdx(ByVal headerName As String) As Long
    Dim lo As ListObject, i As Long, key As String
    key = UCase$(headerName)
    If mColIndex Is Nothing Then
        Set mColIndex = NewDictionary()
        Set lo = MasterTable()
        For i = 1 To lo.ListColumns.Count
            mColIndex(UCase$(lo.ListColumns(i).Name)) = i
        Next i
    End If
    If mColIndex.Exists(key) Then
        ColIdx = mColIndex(key)
    Else
        Err.Raise vbObjectError + 1010, "modMasterList.ColIdx", _
                  "Column '" & headerName & "' does not exist in " & TBL_MASTER & _
                  ". The MASTER_LIST structure has been altered."
    End If
End Function

Public Function MasterRowCount() As Long
    Dim lo As ListObject
    Set lo = MasterTable()
    If lo.ListRows Is Nothing Then Exit Function
    MasterRowCount = lo.ListRows.Count
End Function

'==============================================================================
' Field access (a "row" is a ListRow of tblMaster)
'==============================================================================
Public Function MLGet(ByVal r As ListRow, ByVal headerName As String) As Variant
    MLGet = r.Range.Cells(1, ColIdx(headerName)).Value
End Function

Public Function MLGetStr(ByVal r As ListRow, ByVal headerName As String) As String
    MLGetStr = NzTrim(MLGet(r, headerName))
End Function

Public Function MLGetDate(ByVal r As ListRow, ByVal headerName As String) As Date
    MLGetDate = NzDate(MLGet(r, headerName))
End Function

Public Sub MLSet(ByVal r As ListRow, ByVal headerName As String, ByVal newValue As Variant)
    Dim c As Range
    Set c = r.Range.Cells(1, ColIdx(headerName))
    If VarType(newValue) = vbDate Then
        c.Value = newValue
        c.NumberFormat = "dd-mmm-yyyy hh:mm"
    Else
        c.Value = newValue
    End If
End Sub

'--- Set only when the target cell is currently empty --------------------------
Public Sub MLSetIfBlank(ByVal r As ListRow, ByVal headerName As String, ByVal newValue As Variant)
    If Len(MLGetStr(r, headerName)) = 0 Then MLSet r, headerName, newValue
End Sub

Public Sub MLTouch(ByVal r As ListRow, ByVal actionName As String)
    MLSet r, COL_LASTUPDATED, Now
    If Len(actionName) > 0 Then MLSet r, COL_LASTACTION, actionName
End Sub

'==============================================================================
' Row lookup - topic 70: never operate on the wrong row
'==============================================================================
Public Function FindPartRow(ByVal partNumber As String, _
                            Optional ByVal revision As String = vbNullString) As ListRow
    Dim lo As ListObject, r As ListRow
    Dim pn As String, rv As String
    Dim hits As Collection

    pn = UCase$(Trim$(partNumber))
    rv = UCase$(Trim$(revision))
    If Len(pn) = 0 Then Exit Function

    Set lo = MasterTable()
    Set hits = New Collection
    For Each r In lo.ListRows
        If UCase$(MLGetStr(r, COL_PARTNO)) = pn Then
            If Len(rv) = 0 Then
                hits.Add r
            ElseIf UCase$(MLGetStr(r, COL_REVISION)) = rv Then
                hits.Add r
            End If
        End If
    Next r

    If hits.Count = 1 Then
        Set FindPartRow = hits(1)
    ElseIf hits.Count > 1 Then
        ' Ambiguous - the caller must supply a revision.
        Err.Raise vbObjectError + 1011, "modMasterList.FindPartRow", _
                  "Part Number '" & partNumber & "' exists " & hits.Count & _
                  " times in MASTER_LIST. Specify the Revision on the CONTROL_PANEL " & _
                  "so the correct row can be used."
    End If
End Function

Public Function PartExists(ByVal partNumber As String, ByVal revision As String) As Boolean
    Dim lo As ListObject, r As ListRow
    Set lo = MasterTable()
    For Each r In lo.ListRows
        If UCase$(MLGetStr(r, COL_PARTNO)) = UCase$(Trim$(partNumber)) And _
           UCase$(MLGetStr(r, COL_REVISION)) = UCase$(Trim$(revision)) Then
            PartExists = True
            Exit Function
        End If
    Next r
End Function

'--- The part currently chosen on CONTROL_PANEL --------------------------------
Public Function SelectedPartNumber() As String
    On Error Resume Next
    SelectedPartNumber = NzTrim(ThisWorkbook.Names(NR_SELPART).RefersToRange.Value)
    On Error GoTo 0
End Function

Public Function SelectedRevision() As String
    On Error Resume Next
    SelectedRevision = NzTrim(ThisWorkbook.Names(NR_SELREV).RefersToRange.Value)
    On Error GoTo 0
End Function

Public Sub SetSelectedPart(ByVal partNumber As String, ByVal revision As String)
    On Error Resume Next
    ThisWorkbook.Names(NR_SELPART).RefersToRange.Value = partNumber
    ThisWorkbook.Names(NR_SELREV).RefersToRange.Value = revision
    On Error GoTo 0
End Sub

'--- Resolve the selected row, or show the topic-70 message and return Nothing -
Public Function GetSelectedRow(Optional ByVal announce As Boolean = True) As ListRow
    Dim pn As String, rv As String, r As ListRow

    pn = SelectedPartNumber()
    rv = SelectedRevision()

    If Len(pn) = 0 Then
        If announce Then WarnBox "Please select a Part Number before running automation."
        Exit Function
    End If

    On Error GoTo Ambiguous
    Set r = FindPartRow(pn, rv)
    On Error GoTo 0

    If r Is Nothing Then
        If announce Then
            WarnBox "Part Number '" & pn & "'" & _
                    IIf(Len(rv) > 0, " / Revision '" & rv & "'", vbNullString) & _
                    " was not found in MASTER_LIST." & vbCrLf & vbCrLf & _
                    "Use SEARCH or NEW PART on the CONTROL_PANEL."
        End If
        Exit Function
    End If

    Set GetSelectedRow = r
    Exit Function

Ambiguous:
    If announce Then WarnBox Err.Description
End Function

'==============================================================================
' Derived paths - topics 11, 24, 39, 118
' Everything is computed from Project Folder + Part Number so that SEND PDF
' never has to ask the user to browse for a file.
'==============================================================================
Public Function SafePartName(ByVal r As ListRow) As String
    SafePartName = SanitizeFileName(MLGetStr(r, COL_PARTNO))
End Function

Public Function ProjectPathFor(ByVal r As ListRow) As String
    Dim root As String
    root = MLGetStr(r, COL_PROJFOLDER)
    If Len(root) = 0 Then root = GetConfigValue(CFG_PROJECTROOT, vbNullString)
    If Len(root) = 0 Then Exit Function
    ProjectPathFor = PathJoin(root, SafePartName(r))
End Function

Public Function DwgFolderFor(ByVal r As ListRow) As String
    Dim sub_ As String
    sub_ = MLGetStr(r, COL_DWGFOLDER)
    If Len(sub_) = 0 Then sub_ = FLD_DWG
    DwgFolderFor = PathJoin(ProjectPathFor(r), sub_)
End Function

Public Function ExcelFolderFor(ByVal r As ListRow) As String
    Dim sub_ As String
    sub_ = MLGetStr(r, COL_XLFOLDER)
    If Len(sub_) = 0 Then sub_ = FLD_EXCEL
    ExcelFolderFor = PathJoin(ProjectPathFor(r), sub_)
End Function

Public Function PdfFolderFor(ByVal r As ListRow) As String
    Dim sub_ As String
    sub_ = MLGetStr(r, COL_PDFFOLDER)
    If Len(sub_) = 0 Then sub_ = FLD_PDF
    PdfFolderFor = PathJoin(ProjectPathFor(r), sub_)
End Function

Public Function BackupFolderFor(ByVal r As ListRow) As String
    BackupFolderFor = PathJoin(ProjectPathFor(r), FLD_BACKUP)
End Function

Public Function ExcelFileFor(ByVal r As ListRow) As String
    ExcelFileFor = PathJoin(ExcelFolderFor(r), SafePartName(r) & ".xlsx")
End Function

Public Function DwgFileFor(ByVal r As ListRow) As String
    DwgFileFor = PathJoin(DwgFolderFor(r), SafePartName(r) & ".dwg")
End Function

Public Function PdfFileFor(ByVal r As ListRow) As String
    PdfFileFor = PathJoin(PdfFolderFor(r), SafePartName(r) & ".pdf")
End Function

'--- Template comes from the row, else from CONFIG (topics 19, 95) -------------
Public Function TemplateFor(ByVal r As ListRow) As String
    TemplateFor = MLGetStr(r, COL_DWGTEMPLATE)
    If Len(TemplateFor) = 0 Then TemplateFor = GetConfigValue(CFG_DWGTEMPLATE, vbNullString)
End Function

'--- Unique process identifier, e.g. PN-10025-A-CT (topic 23) ------------------
Public Function ProcessUID(ByVal r As ListRow, ByVal processCode As String) As String
    ProcessUID = MLGetStr(r, COL_PARTNO) & "-" & MLGetStr(r, COL_REVISION) & "-" & UCase$(processCode)
End Function

'--- Refresh the stored path columns so the sheet always shows the truth -------
Public Sub RefreshPathColumns(ByVal r As ListRow)
    MLSet r, COL_PROJECTPATH, ProjectPathFor(r)
    If FileExists(ExcelFileFor(r)) Then MLSet r, COL_EXCELPATH, ExcelFileFor(r)
    If FileExists(DwgFileFor(r)) Then MLSet r, COL_DWGPATH, DwgFileFor(r)
    If FileExists(PdfFileFor(r)) Then MLSet r, COL_PDFPATH, PdfFileFor(r)
End Sub

'==============================================================================
' Topic 71 - NEW PART
'==============================================================================
Public Function AddPartRow(ByVal partNumber As String, _
                           ByVal revision As String, _
                           ByVal customer As String, _
                           ByVal route As String, _
                           ByVal projectFolder As String, _
                           ByVal dwgTemplate As String, _
                           ByVal routeOK As String, _
                           ByVal pdfOK As String, _
                           ByVal mailOK As String, _
                           ByVal mailRequired As String) As ListRow
    Dim lo As ListObject, r As ListRow

    Set lo = MasterTable()
    Set r = lo.ListRows.Add

    MLSet r, COL_SNO, lo.ListRows.Count
    MLSet r, COL_PARTNO, Trim$(partNumber)
    MLSet r, COL_REVISION, Trim$(revision)
    MLSet r, COL_CUSTOMER, Trim$(customer)
    MLSet r, COL_ROUTE, UCase$(Trim$(route))
    MLSet r, COL_PROJFOLDER, Trim$(projectFolder)
    MLSet r, COL_DWGTEMPLATE, Trim$(dwgTemplate)
    MLSet r, COL_DWGFOLDER, FLD_DWG
    MLSet r, COL_XLFOLDER, FLD_EXCEL
    MLSet r, COL_PDFFOLDER, FLD_PDF

    MLSet r, COL_ROUTEOK, UCase$(Trim$(routeOK))
    MLSet r, COL_PDFOK, UCase$(Trim$(pdfOK))
    MLSet r, COL_MAILOK, UCase$(Trim$(mailOK))
    MLSet r, COL_MAILREQUIRED, UCase$(Trim$(mailRequired))
    MLSet r, COL_APPROVALSTATUS, AP_PENDING

    MLSet r, COL_FOLDERSTATUS, ST_NOTSTARTED
    MLSet r, COL_EXCELSTATUS, ST_NOTSTARTED
    MLSet r, COL_DWGSTATUS, ST_NOTSTARTED
    MLSet r, COL_PDFSTATUS, ST_NOTSTARTED
    MLSet r, COL_MAILSTATUS, ST_NOTSTARTED
    MLSet r, COL_AUTOSTATUS, ST_NOTSTARTED

    MLSet r, COL_PROJECTPATH, ProjectPathFor(r)
    MLSet r, COL_CREATEDDATE, Now
    MLSet r, COL_ERRORSTATUS, vbNullString
    MLSet r, COL_ERRORMSG, vbNullString
    MLTouch r, ACT_NEWPART

    Set AddPartRow = r
End Function

'--- Renumber S.No after insertions / deletions --------------------------------
Public Sub RenumberSerials()
    Dim lo As ListObject, i As Long
    Set lo = MasterTable()
    For i = 1 To lo.ListRows.Count
        lo.ListRows(i).Range.Cells(1, ColIdx(COL_SNO)).Value = i
    Next i
End Sub

'==============================================================================
' Topics 54 / 69 - search
'==============================================================================
Public Function SearchParts(ByVal fieldName As String, ByVal searchText As String) As Collection
    Dim lo As ListObject, r As ListRow, c As Collection
    Dim needle As String, hay As String

    Set c = New Collection
    needle = UCase$(Trim$(searchText))
    If Len(needle) = 0 Then
        Set SearchParts = c
        Exit Function
    End If

    Set lo = MasterTable()
    For Each r In lo.ListRows
        Select Case UCase$(Trim$(fieldName))
            Case UCase$(COL_PARTNO):   hay = MLGetStr(r, COL_PARTNO)
            Case UCase$(COL_CUSTOMER): hay = MLGetStr(r, COL_CUSTOMER)
            Case UCase$(COL_REVISION): hay = MLGetStr(r, COL_REVISION)
            Case UCase$(COL_ROUTE):    hay = MLGetStr(r, COL_ROUTE)
            Case Else
                hay = MLGetStr(r, COL_PARTNO) & "|" & MLGetStr(r, COL_CUSTOMER) & "|" & _
                      MLGetStr(r, COL_REVISION) & "|" & MLGetStr(r, COL_ROUTE)
        End Select
        If InStr(1, hay, needle, vbTextCompare) > 0 Then c.Add r
    Next r

    Set SearchParts = c
End Function
