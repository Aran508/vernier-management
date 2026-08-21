Attribute VB_Name = "modLogger"
'==============================================================================
' Module      : modLogger
' Purpose     : AUTOMATION_LOG. Every state change and every mail operation is
'               written here (topic 66). Logging never raises an error back to
'               the caller - a broken log must not stop production work.
'==============================================================================
Option Explicit

'--- Topic 114: LogAction ------------------------------------------------------
Public Sub LogAction(ByVal partNumber As String, _
                     ByVal revision As String, _
                     ByVal actionName As String, _
                     ByVal previousStatus As String, _
                     ByVal newStatus As String, _
                     ByVal result As String, _
                     Optional ByVal errorMessage As String = vbNullString, _
                     Optional ByVal mailAction As String = vbNullString, _
                     Optional ByVal recipient As String = vbNullString, _
                     Optional ByVal ccList As String = vbNullString, _
                     Optional ByVal subjectText As String = vbNullString, _
                     Optional ByVal attachment As String = vbNullString, _
                     Optional ByVal sendStatus As String = vbNullString)

    Dim lo As ListObject, r As ListRow
    Dim prevEvents As Boolean

    prevEvents = Application.EnableEvents
    On Error GoTo Silent
    If Not TableExists(SH_LOG, TBL_LOG) Then Exit Sub

    Application.EnableEvents = False

    Set lo = RequireTable(SH_LOG, TBL_LOG)
    Set r = lo.ListRows.Add

    SetLogCell lo, r, LG_ID, NextLogID(lo)
    SetLogCell lo, r, LG_DATE, Format$(Date, "dd-mmm-yyyy")
    SetLogCell lo, r, LG_TIME, Format$(Now, "hh:nn:ss")
    SetLogCell lo, r, LG_PARTNO, partNumber
    SetLogCell lo, r, LG_REVISION, revision
    SetLogCell lo, r, LG_ACTION, actionName
    SetLogCell lo, r, LG_PREVSTATUS, previousStatus
    SetLogCell lo, r, LG_NEWSTATUS, newStatus
    SetLogCell lo, r, LG_USER, CurrentUser()
    SetLogCell lo, r, LG_RESULT, result
    SetLogCell lo, r, LG_ERROR, Left$(errorMessage, 500)
    SetLogCell lo, r, LG_MAILACTION, mailAction
    SetLogCell lo, r, LG_RECIPIENT, Left$(recipient, 500)
    SetLogCell lo, r, LG_CC, Left$(ccList, 500)
    SetLogCell lo, r, LG_SUBJECT, Left$(subjectText, 300)
    SetLogCell lo, r, LG_ATTACHMENT, Left$(attachment, 300)
    SetLogCell lo, r, LG_SENDSTATUS, sendStatus

    Application.EnableEvents = prevEvents
    Exit Sub

Silent:
    On Error Resume Next
    Application.EnableEvents = prevEvents
End Sub

'--- Convenience wrapper for a row of tblMaster --------------------------------
Public Sub LogRowAction(ByVal r As ListRow, _
                        ByVal actionName As String, _
                        ByVal previousStatus As String, _
                        ByVal newStatus As String, _
                        ByVal result As String, _
                        Optional ByVal errorMessage As String = vbNullString)
    On Error Resume Next
    LogAction MLGetStr(r, COL_PARTNO), MLGetStr(r, COL_REVISION), actionName, _
              previousStatus, newStatus, result, errorMessage
End Sub

'--- Mail-specific log entry (topic 66 mail columns) ---------------------------
Public Sub LogMailAction(ByVal r As ListRow, _
                         ByVal mailAction As String, _
                         ByVal result As String, _
                         ByVal recipient As String, _
                         ByVal ccList As String, _
                         ByVal subjectText As String, _
                         ByVal attachment As String, _
                         ByVal sendStatus As String, _
                         Optional ByVal errorMessage As String = vbNullString)
    On Error Resume Next
    LogAction MLGetStr(r, COL_PARTNO), MLGetStr(r, COL_REVISION), mailAction, _
              vbNullString, sendStatus, result, errorMessage, _
              mailAction, recipient, ccList, subjectText, attachment, sendStatus
End Sub

Private Sub SetLogCell(ByVal lo As ListObject, ByVal r As ListRow, _
                       ByVal headerName As String, ByVal v As Variant)
    Dim idx As Long
    idx = ColumnIndexOf(lo, headerName)
    If idx > 0 Then r.Range.Cells(1, idx).Value = v
End Sub

Private Function NextLogID(ByVal lo As ListObject) As Long
    Dim idx As Long, n As Long
    idx = ColumnIndexOf(lo, LG_ID)
    n = lo.ListRows.Count
    If n <= 1 Or idx = 0 Then
        NextLogID = 1
    Else
        NextLogID = NzLng(lo.ListRows(n - 1).Range.Cells(1, idx).Value, n - 1) + 1
    End If
End Function

'--- Trim the log when it becomes very large (keeps the workbook responsive) ---
Public Sub TrimLog(Optional ByVal keepRows As Long = 20000)
    Dim lo As ListObject, excess As Long
    On Error Resume Next
    If Not TableExists(SH_LOG, TBL_LOG) Then Exit Sub
    Set lo = RequireTable(SH_LOG, TBL_LOG)
    excess = lo.ListRows.Count - keepRows
    Do While excess > 0
        lo.ListRows(1).Delete
        excess = excess - 1
    Loop
End Sub
