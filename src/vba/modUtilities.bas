Attribute VB_Name = "modUtilities"
'==============================================================================
' Module      : modUtilities
' Purpose     : Small, dependency-free helpers used everywhere.
'==============================================================================
Option Explicit

'--- Return a worksheet from the master workbook, or Nothing if absent ---------
Public Function GetSheet(ByVal sheetName As String) As Worksheet
    On Error Resume Next
    Set GetSheet = ThisWorkbook.Worksheets(sheetName)
    On Error GoTo 0
End Function

'--- Return a worksheet and raise a clear error if it is missing ---------------
Public Function RequireSheet(ByVal sheetName As String) As Worksheet
    Set RequireSheet = GetSheet(sheetName)
    If RequireSheet Is Nothing Then
        Err.Raise vbObjectError + 1001, "RequireSheet", _
                  "Worksheet '" & sheetName & "' was not found in " & ThisWorkbook.Name & _
                  ". Run BUILD_3P_WORKBOOK from modBuilder to rebuild the structure."
    End If
End Function

'--- Return a ListObject and raise a clear error if it is missing --------------
Public Function RequireTable(ByVal sheetName As String, ByVal tableName As String) As ListObject
    Dim ws As Worksheet
    Set ws = RequireSheet(sheetName)
    On Error Resume Next
    Set RequireTable = ws.ListObjects(tableName)
    On Error GoTo 0
    If RequireTable Is Nothing Then
        Err.Raise vbObjectError + 1002, "RequireTable", _
                  "Table '" & tableName & "' was not found on sheet '" & sheetName & "'."
    End If
End Function

Public Function TableExists(ByVal sheetName As String, ByVal tableName As String) As Boolean
    Dim ws As Worksheet, lo As ListObject
    Set ws = GetSheet(sheetName)
    If ws Is Nothing Then Exit Function
    On Error Resume Next
    Set lo = ws.ListObjects(tableName)
    On Error GoTo 0
    TableExists = Not (lo Is Nothing)
End Function

'--- Normalised text helpers ---------------------------------------------------
Public Function NzTrim(ByVal v As Variant) As String
    If IsError(v) Then
        NzTrim = vbNullString
    ElseIf IsNull(v) Then
        NzTrim = vbNullString
    Else
        NzTrim = Trim$(CStr(v))
    End If
End Function

Public Function NzUpper(ByVal v As Variant) As String
    NzUpper = UCase$(NzTrim(v))
End Function

Public Function IsYes(ByVal v As Variant) As Boolean
    IsYes = (NzUpper(v) = YES_)
End Function

Public Function YesNo(ByVal b As Boolean) As String
    If b Then YesNo = YES_ Else YesNo = NO_
End Function

'--- Safe date conversion (empty cells return 0) -------------------------------
Public Function NzDate(ByVal v As Variant) As Date
    On Error Resume Next
    If IsEmpty(v) Or IsNull(v) Then Exit Function
    If Len(NzTrim(v)) = 0 Then Exit Function
    NzDate = CDate(v)
    On Error GoTo 0
End Function

Public Function NzDbl(ByVal v As Variant, Optional ByVal defaultValue As Double = 0) As Double
    On Error Resume Next
    NzDbl = defaultValue
    If Len(NzTrim(v)) = 0 Then Exit Function
    If IsNumeric(v) Then NzDbl = CDbl(v)
    On Error GoTo 0
End Function

Public Function NzLng(ByVal v As Variant, Optional ByVal defaultValue As Long = 0) As Long
    NzLng = CLng(NzDbl(v, CDbl(defaultValue)))
End Function

'--- Current Windows user / machine --------------------------------------------
Public Function CurrentUser() As String
    CurrentUser = NzTrim(Environ$("Username"))
    If Len(CurrentUser) = 0 Then CurrentUser = "UNKNOWN"
End Function

Public Function CurrentMachine() As String
    CurrentMachine = NzTrim(Environ$("Computername"))
    If Len(CurrentMachine) = 0 Then CurrentMachine = "UNKNOWN"
End Function

'--- Formatted timestamp for display / file names ------------------------------
Public Function TimeStampCompact(Optional ByVal whenValue As Date) As String
    If whenValue = 0 Then whenValue = Now
    TimeStampCompact = Format$(whenValue, "yyyymmdd_hhnnss")
End Function

Public Function FormatDateOut(ByVal v As Variant) As String
    Dim d As Date
    d = NzDate(v)
    If d = 0 Then
        FormatDateOut = vbNullString
    Else
        FormatDateOut = Format$(d, modConfig.GetConfigValue(CFG_DATEFORMAT, "dd-mmm-yyyy"))
    End If
End Function

'--- Join a collection of strings with a separator -----------------------------
Public Function JoinCollection(ByVal items As Collection, ByVal sep As String) As String
    Dim i As Long, s As String
    For i = 1 To items.Count
        If Len(s) > 0 Then s = s & sep
        s = s & CStr(items(i))
    Next i
    JoinCollection = s
End Function

'--- Case-insensitive "does the collection already hold this key" --------------
Public Function DictHasKey(ByVal dict As Object, ByVal keyValue As String) As Boolean
    If dict Is Nothing Then Exit Function
    DictHasKey = dict.Exists(UCase$(Trim$(keyValue)))
End Function

'--- Create a late-bound Scripting.Dictionary (text keys, case-insensitive) ----
Public Function NewDictionary() As Object
    Set NewDictionary = CreateObject("Scripting.Dictionary")
    NewDictionary.CompareMode = 1   ' vbTextCompare
End Function

'--- Basic e-mail address sanity check (topic 63/112: invalid email) -----------
Public Function IsValidEmail(ByVal addr As String) As Boolean
    Dim s As String, atPos As Long, dotPos As Long
    s = Trim$(addr)
    If Len(s) < 6 Then Exit Function
    If InStr(s, " ") > 0 Then Exit Function
    atPos = InStr(s, "@")
    If atPos < 2 Then Exit Function
    If InStr(atPos + 1, s, "@") > 0 Then Exit Function
    dotPos = InStrRev(s, ".")
    If dotPos < atPos + 2 Then Exit Function
    If dotPos >= Len(s) Then Exit Function
    IsValidEmail = True
End Function

'--- Screen / calculation guards ------------------------------------------------
Public Sub FastMode(ByVal switchOn As Boolean)
    With Application
        .ScreenUpdating = Not switchOn
        .EnableEvents = Not switchOn
        If switchOn Then
            .Calculation = xlCalculationManual
        Else
            .Calculation = xlCalculationAutomatic
        End If
        .StatusBar = False
    End With
End Sub

Public Sub SetStatusBar(ByVal msg As String)
    On Error Resume Next
    If Len(msg) = 0 Then
        Application.StatusBar = False
    Else
        Application.StatusBar = SYS_SHORT & " | " & msg
    End If
    On Error GoTo 0
End Sub

'--- Message helpers -----------------------------------------------------------
Public Sub InfoBox(ByVal msg As String, Optional ByVal title As String = vbNullString)
    If Len(title) = 0 Then title = SYS_SHORT
    MsgBox msg, vbInformation + vbOKOnly, title
End Sub

Public Sub WarnBox(ByVal msg As String, Optional ByVal title As String = vbNullString)
    If Len(title) = 0 Then title = SYS_SHORT & " - Warning"
    MsgBox msg, vbExclamation + vbOKOnly, title
End Sub

Public Sub ErrorBox(ByVal msg As String, Optional ByVal title As String = vbNullString)
    If Len(title) = 0 Then title = SYS_SHORT & " - Error"
    MsgBox msg, vbCritical + vbOKOnly, title
End Sub

Public Function AskYesNo(ByVal msg As String, Optional ByVal title As String = vbNullString) As Boolean
    If Len(title) = 0 Then title = SYS_SHORT & " - Confirm"
    AskYesNo = (MsgBox(msg, vbQuestion + vbYesNo + vbDefaultButton2, title) = vbYes)
End Function

'--- Replace a set of {TOKEN} placeholders in a template ------------------------
Public Function ApplyTokens(ByVal template As String, ByVal tokens As Object) As String
    Dim k As Variant, s As String
    s = template
    If tokens Is Nothing Then
        ApplyTokens = s
        Exit Function
    End If
    For Each k In tokens.Keys
        s = Replace$(s, "{" & CStr(k) & "}", CStr(tokens(k)))
    Next k
    ' Literal "\n" in a configuration cell becomes a real line break.
    s = Replace$(s, "\n", vbCrLf)
    ApplyTokens = s
End Function
