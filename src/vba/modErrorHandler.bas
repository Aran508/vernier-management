Attribute VB_Name = "modErrorHandler"
'==============================================================================
' Module      : modErrorHandler
' Purpose     : One place that turns a trapped VBA error into: a MASTER_LIST
'               error stamp, a log entry and (optionally) a message to the
'               operator. Errors are never silently ignored (topic 63).
'==============================================================================
Option Explicit

'--- Record an error against a part row ----------------------------------------
Public Sub RecordError(ByVal r As ListRow, _
                       ByVal actionName As String, _
                       ByVal errorMessage As String, _
                       Optional ByVal statusColumn As String = vbNullString, _
                       Optional ByVal announce As Boolean = True)

    Dim prev As String
    On Error Resume Next

    If Not r Is Nothing Then
        If Len(statusColumn) > 0 Then
            prev = MLGetStr(r, statusColumn)
            MLSet r, statusColumn, ST_ERROR
        End If
        MLSet r, COL_ERRORSTATUS, "ERROR"
        MLSet r, COL_ERRORMSG, Left$(errorMessage, 900)
        MLSet r, COL_AUTOSTATUS, ST_ERROR
        MLTouch r, actionName
        LogRowAction r, actionName, prev, ST_ERROR, RES_FAIL, errorMessage
    Else
        LogAction vbNullString, vbNullString, actionName, vbNullString, ST_ERROR, _
                  RES_FAIL, errorMessage
    End If

    If announce Then
        ErrorBox actionName & " failed." & vbCrLf & vbCrLf & errorMessage
    End If
End Sub

'--- Clear a previous error stamp once a stage succeeds ------------------------
Public Sub ClearError(ByVal r As ListRow)
    On Error Resume Next
    If r Is Nothing Then Exit Sub
    MLSet r, COL_ERRORSTATUS, vbNullString
    MLSet r, COL_ERRORMSG, vbNullString
End Sub

'--- Build a readable description from the current Err object ------------------
Public Function ErrText(ByVal source As String) As String
    ErrText = source & ": [" & Err.Number & "] " & Err.Description
    If Len(Err.Source) > 0 Then ErrText = ErrText & " (source: " & Err.Source & ")"
End Function

'--- Raise a business-rule error with a clean message --------------------------
Public Sub Fail(ByVal source As String, ByVal message As String)
    Err.Raise vbObjectError + 2000, source, message
End Sub
