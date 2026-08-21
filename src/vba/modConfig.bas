Attribute VB_Name = "modConfig"
'==============================================================================
' Module      : modConfig
' Purpose     : Read-only access to CONFIG, USER_CONFIG, PROCESS_CONFIG and
'               PROCESS_OWNER_CONFIG. Nothing that an engineer may want to
'               change is hard-coded in VBA (topics 17, 58, 60, 73, 74, 108).
'==============================================================================
Option Explicit

'--- One row of PROCESS_CONFIG -------------------------------------------------
Public Type ProcessDef
    Code        As String
    Name        As String
    BlockName   As String
    SheetName   As String
    Enabled     As Boolean
    X           As Double
    Y           As Double
    ScaleX      As Double
    ScaleY      As Double
    Rotation    As Double
    Description As String
    Owner       As String
    Found       As Boolean
End Type

'--- One row of PROCESS_OWNER_CONFIG -------------------------------------------
Public Type OwnerDef
    Code      As String
    Name      As String
    Owner     As String
    Email     As String
    CcEmail   As String
    Enabled   As Boolean
    Found     As Boolean
End Type

Private mConfigCache As Object       ' key -> value
Private mUserCache As Object

'==============================================================================
' CONFIG sheet
'==============================================================================
Public Sub ClearConfigCache()
    Set mConfigCache = Nothing
    Set mUserCache = Nothing
End Sub

Private Function ConfigCache() As Object
    Dim lo As ListObject, r As ListRow, k As String
    If Not mConfigCache Is Nothing Then
        Set ConfigCache = mConfigCache
        Exit Function
    End If
    Set mConfigCache = NewDictionary()
    If TableExists(SH_CONFIG, TBL_CONFIG) Then
        Set lo = RequireTable(SH_CONFIG, TBL_CONFIG)
        For Each r In lo.ListRows
            k = NzTrim(r.Range.Cells(1, 1).Value)
            If Len(k) > 0 Then mConfigCache(k) = r.Range.Cells(1, 2).Value
        Next r
    End If
    Set ConfigCache = mConfigCache
End Function

'--- Read a CONFIG value, falling back to a supplied default -------------------
Public Function GetConfigValue(ByVal keyName As String, _
                               Optional ByVal defaultValue As String = vbNullString) As String
    Dim d As Object
    Set d = ConfigCache()
    If d.Exists(keyName) Then
        GetConfigValue = NzTrim(d(keyName))
        If Len(GetConfigValue) = 0 Then GetConfigValue = defaultValue
    Else
        GetConfigValue = defaultValue
    End If
End Function

Public Function GetConfigDouble(ByVal keyName As String, ByVal defaultValue As Double) As Double
    GetConfigDouble = NzDbl(GetConfigValue(keyName, CStr(defaultValue)), defaultValue)
End Function

Public Function GetConfigBool(ByVal keyName As String, ByVal defaultValue As Boolean) As Boolean
    Dim s As String
    s = UCase$(GetConfigValue(keyName, YesNo(defaultValue)))
    GetConfigBool = (s = YES_ Or s = "TRUE" Or s = "1")
End Function

'--- Write a CONFIG value back (used by the builder and by SetEmailSendMode) ---
Public Sub SetConfigValue(ByVal keyName As String, ByVal newValue As String)
    Dim lo As ListObject, r As ListRow, newRow As ListRow
    Set lo = RequireTable(SH_CONFIG, TBL_CONFIG)
    For Each r In lo.ListRows
        If StrComp(NzTrim(r.Range.Cells(1, 1).Value), keyName, vbTextCompare) = 0 Then
            r.Range.Cells(1, 2).Value = newValue
            ClearConfigCache
            Exit Sub
        End If
    Next r
    Set newRow = lo.ListRows.Add
    newRow.Range.Cells(1, 1).Value = keyName
    newRow.Range.Cells(1, 2).Value = newValue
    ClearConfigCache
End Sub

'--- Email send mode is DISPLAY unless CONFIG explicitly says SEND (topic 38) --
Public Function EmailSendMode() As String
    Dim m As String
    m = UCase$(GetConfigValue(CFG_MAILMODE, "DISPLAY"))
    If m <> "SEND" Then m = "DISPLAY"
    EmailSendMode = m
End Function

'--- Distribution mode (topic 59) ----------------------------------------------
Public Function EmailDistributionMode() As String
    Dim m As String
    m = UCase$(GetConfigValue(CFG_MAILDIST, "ALL_ROUTE_OWNERS"))
    Select Case m
        Case "ALL_ROUTE_OWNERS", "CURRENT_PROCESS_OWNER", "CUSTOM"
        Case Else: m = "ALL_ROUTE_OWNERS"
    End Select
    EmailDistributionMode = m
End Function

Public Function AllowDuplicateProcessCodes() As Boolean
    AllowDuplicateProcessCodes = GetConfigBool(CFG_ALLOWDUPPROC, False)
End Function

'==============================================================================
' USER_CONFIG sheet
'==============================================================================
Private Function UserCache() As Object
    Dim lo As ListObject, r As ListRow, k As String
    If Not mUserCache Is Nothing Then
        Set UserCache = mUserCache
        Exit Function
    End If
    Set mUserCache = NewDictionary()
    If TableExists(SH_USER, TBL_USER) Then
        Set lo = RequireTable(SH_USER, TBL_USER)
        For Each r In lo.ListRows
            k = NzTrim(r.Range.Cells(1, 1).Value)
            If Len(k) > 0 Then mUserCache(k) = r.Range.Cells(1, 2).Value
        Next r
    End If
    Set UserCache = mUserCache
End Function

Public Function GetUserValue(ByVal keyName As String, _
                             Optional ByVal defaultValue As String = vbNullString) As String
    Dim d As Object
    Set d = UserCache()
    If d.Exists(keyName) Then
        GetUserValue = NzTrim(d(keyName))
        If Len(GetUserValue) = 0 Then GetUserValue = defaultValue
    Else
        GetUserValue = defaultValue
    End If
End Function

Public Sub SetUserValue(ByVal keyName As String, ByVal newValue As String)
    Dim lo As ListObject, r As ListRow, newRow As ListRow
    Set lo = RequireTable(SH_USER, TBL_USER)
    For Each r In lo.ListRows
        If StrComp(NzTrim(r.Range.Cells(1, 1).Value), keyName, vbTextCompare) = 0 Then
            r.Range.Cells(1, 2).Value = newValue
            Set mUserCache = Nothing
            Exit Sub
        End If
    Next r
    Set newRow = lo.ListRows.Add
    newRow.Range.Cells(1, 1).Value = keyName
    newRow.Range.Cells(1, 2).Value = newValue
    Set mUserCache = Nothing
End Sub

'--- Display name of the operator, defaulting to the Windows account -----------
Public Function CurrentUserName() As String
    CurrentUserName = GetUserValue(USR_NAME, vbNullString)
    If Len(CurrentUserName) = 0 Then CurrentUserName = CurrentUser()
End Function

Public Function CurrentDepartment() As String
    CurrentDepartment = GetUserValue(USR_DEPT, _
                        GetConfigValue(CFG_DEPARTMENT, "Production Engineering Department"))
End Function

'--- Stamp machine name and last login on open (topic 60) ----------------------
Public Sub RefreshUserSession()
    On Error Resume Next
    SetUserValue USR_MACHINE, CurrentMachine()
    SetUserValue USR_LASTLOGIN, Format$(Now, "dd-mmm-yyyy hh:nn:ss")
    If Len(GetUserValue(USR_NAME, vbNullString)) = 0 Then SetUserValue USR_NAME, CurrentUser()
    On Error GoTo 0
End Sub

'==============================================================================
' PROCESS_CONFIG sheet
'==============================================================================
'--- Look up one process definition by code ------------------------------------
Public Function GetProcessDef(ByVal processCode As String) As ProcessDef
    Dim lo As ListObject, r As ListRow, code As String
    Dim d As ProcessDef
    code = UCase$(Trim$(processCode))
    Set lo = RequireTable(SH_PROCESS, TBL_PROCESS)
    For Each r In lo.ListRows
        If UCase$(NzTrim(GetCell(lo, r, PC_CODE))) = code Then
            d.Code = code
            d.Name = NzTrim(GetCell(lo, r, PC_NAME))
            d.BlockName = NzTrim(GetCell(lo, r, PC_BLOCK))
            d.SheetName = NzTrim(GetCell(lo, r, PC_SHEET))
            d.Enabled = IsYes(GetCell(lo, r, PC_ENABLED))
            d.X = NzDbl(GetCell(lo, r, PC_X), 0)
            d.Y = NzDbl(GetCell(lo, r, PC_Y), 0)
            d.ScaleX = NzDbl(GetCell(lo, r, PC_SCALEX), GetConfigDouble(CFG_BLOCKSCALE, 1))
            d.ScaleY = NzDbl(GetCell(lo, r, PC_SCALEY), GetConfigDouble(CFG_BLOCKSCALE, 1))
            d.Rotation = NzDbl(GetCell(lo, r, PC_ROTATION), 0)
            d.Description = NzTrim(GetCell(lo, r, PC_DESC))
            d.Owner = NzTrim(GetCell(lo, r, PC_OWNER))
            If Len(d.SheetName) = 0 Then d.SheetName = d.Code
            If d.ScaleX = 0 Then d.ScaleX = 1
            If d.ScaleY = 0 Then d.ScaleY = 1
            d.Found = True
            Exit For
        End If
    Next r
    GetProcessDef = d
End Function

Public Function ProcessCodeExists(ByVal processCode As String) As Boolean
    Dim d As ProcessDef
    d = GetProcessDef(processCode)
    ProcessCodeExists = d.Found
End Function

Public Function ProcessCodeEnabled(ByVal processCode As String) As Boolean
    Dim d As ProcessDef
    d = GetProcessDef(processCode)
    ProcessCodeEnabled = (d.Found And d.Enabled)
End Function

'--- All enabled process codes, in sheet order, semicolon-free -----------------
Public Function ValidProcessCodes() As Collection
    Dim lo As ListObject, r As ListRow, c As Collection, code As String
    Set c = New Collection
    Set lo = RequireTable(SH_PROCESS, TBL_PROCESS)
    For Each r In lo.ListRows
        code = UCase$(NzTrim(GetCell(lo, r, PC_CODE)))
        If Len(code) > 0 And IsYes(GetCell(lo, r, PC_ENABLED)) Then c.Add code
    Next r
    Set ValidProcessCodes = c
End Function

Public Function ValidProcessCodeList(Optional ByVal sep As String = vbCrLf) As String
    ValidProcessCodeList = JoinCollection(ValidProcessCodes(), sep)
End Function

'==============================================================================
' PROCESS_OWNER_CONFIG sheet
'==============================================================================
Public Function GetOwnerDef(ByVal processCode As String) As OwnerDef
    Dim lo As ListObject, r As ListRow, code As String
    Dim o As OwnerDef
    code = UCase$(Trim$(processCode))
    Set lo = RequireTable(SH_OWNER, TBL_OWNER)
    For Each r In lo.ListRows
        If UCase$(NzTrim(GetCell(lo, r, OW_CODE))) = code Then
            o.Code = code
            o.Name = NzTrim(GetCell(lo, r, OW_NAME))
            o.Owner = NzTrim(GetCell(lo, r, OW_OWNER))
            o.Email = NzTrim(GetCell(lo, r, OW_EMAIL))
            o.CcEmail = NzTrim(GetCell(lo, r, OW_CC))
            o.Enabled = IsYes(GetCell(lo, r, OW_ENABLED))
            o.Found = True
            Exit For
        End If
    Next r
    GetOwnerDef = o
End Function

'--- Topic 114: GetProcessOwnerEmail -------------------------------------------
Public Function GetProcessOwnerEmail(ByVal processCode As String) As String
    Dim o As OwnerDef
    o = GetOwnerDef(processCode)
    If o.Found And o.Enabled Then GetProcessOwnerEmail = o.Email
End Function

Public Function GetProcessOwnerCC(ByVal processCode As String) As String
    Dim o As OwnerDef
    o = GetOwnerDef(processCode)
    If o.Found And o.Enabled Then GetProcessOwnerCC = o.CcEmail
End Function

'==============================================================================
' Generic table cell reader by header name
'==============================================================================
Public Function GetCell(ByVal lo As ListObject, ByVal r As ListRow, ByVal headerName As String) As Variant
    Dim idx As Long
    idx = ColumnIndexOf(lo, headerName)
    If idx = 0 Then
        GetCell = vbNullString
    Else
        GetCell = r.Range.Cells(1, idx).Value
    End If
End Function

Public Function ColumnIndexOf(ByVal lo As ListObject, ByVal headerName As String) As Long
    Dim i As Long
    For i = 1 To lo.ListColumns.Count
        If StrComp(lo.ListColumns(i).Name, headerName, vbTextCompare) = 0 Then
            ColumnIndexOf = i
            Exit Function
        End If
    Next i
End Function
