Attribute VB_Name = "modValidation"
'==============================================================================
' Module      : modValidation
' Purpose     : Field-level validation for a MASTER_LIST row. Nothing on disk
'               is touched until these checks pass. Topics 9, 19, 92, 107, 114.
'==============================================================================
Option Explicit

'==============================================================================
' Validate the fields the automation depends on. errMsg is ready to display.
'==============================================================================
Public Function ValidatePartFields(ByVal r As ListRow, ByRef errMsg As String) As Boolean
    Dim problems As Collection
    Dim pn As String, rev As String, cust As String
    Dim proj As String, tpl As String

    Set problems = New Collection
    errMsg = vbNullString

    pn = MLGetStr(r, COL_PARTNO)
    rev = MLGetStr(r, COL_REVISION)
    cust = MLGetStr(r, COL_CUSTOMER)
    proj = MLGetStr(r, COL_PROJFOLDER)
    tpl = TemplateFor(r)

    '--- Part Number ---
    If Len(pn) = 0 Then
        problems.Add "Part Number is blank."
    ElseIf ContainsIllegalFileChars(pn) Then
        problems.Add "Part Number contains characters Windows does not allow in a file name" & _
                     " ( \ / : * ? "" < > | ). Suggested: " & SanitizeFileName(pn)
    ElseIf Len(pn) > 80 Then
        problems.Add "Part Number is longer than 80 characters."
    End If

    '--- Revision ---
    If Len(rev) = 0 Then
        problems.Add "Revision is blank."
    ElseIf Len(rev) > 10 Then
        problems.Add "Revision is longer than 10 characters."
    End If

    '--- Customer ---
    If Len(cust) = 0 Then problems.Add "Customer is blank."

    '--- Project Folder ---
    If Len(proj) = 0 Then
        problems.Add "Project Folder is blank. Enter it in MASTER_LIST or set '" & _
                     CFG_PROJECTROOT & "' in CONFIG."
    ElseIf Not FolderExists(proj) Then
        problems.Add "Project Folder does not exist on this computer:" & vbCrLf & "    " & proj
    ElseIf Not FolderIsWritable(proj) Then
        problems.Add "Project Folder is not writable (permission denied):" & vbCrLf & "    " & proj
    End If

    '--- DWG Template ---
    If Len(tpl) = 0 Then
        problems.Add "DWG Template is blank. Enter it in MASTER_LIST or set '" & _
                     CFG_DWGTEMPLATE & "' in CONFIG."
    ElseIf Not FileExists(tpl) Then
        problems.Add "AutoCAD template not found:" & vbCrLf & "    " & tpl
    End If

    '--- Route present (detailed checking lives in modRoute) ---
    If Len(MLGetStr(r, COL_ROUTE)) = 0 Then problems.Add "Route is blank."

    '--- Approval (topic 107) ---
    If UCase$(MLGetStr(r, COL_APPROVALSTATUS)) = UCase$(AP_REJECTED) Then
        problems.Add "Document approval is rejected. Automation cannot continue."
    End If

    If problems.Count = 0 Then
        ValidatePartFields = True
    Else
        errMsg = "VALIDATION FAILED" & vbCrLf & vbCrLf & _
                 "Part Number: " & IIf(Len(pn) = 0, "(blank)", pn) & vbCrLf & vbCrLf & _
                 BulletList(problems)
    End If
End Function

Private Function BulletList(ByVal items As Collection) As String
    Dim i As Long, s As String
    For i = 1 To items.Count
        s = s & i & ". " & items(i) & vbCrLf
    Next i
    BulletList = s
End Function

'==============================================================================
' Topic 114 - ValidateSelectedPart. Used by RUN AUTOMATION before anything else.
'==============================================================================
Public Function ValidateSelectedPart(ByVal r As ListRow, ByRef errMsg As String) As Boolean
    Dim fieldMsg As String, routeMsg As String

    If r Is Nothing Then
        errMsg = "Please select a Part Number before running automation."
        Exit Function
    End If

    If Not ValidatePartFields(r, fieldMsg) Then
        errMsg = fieldMsg
        Exit Function
    End If

    If Not ValidateRouteString(MLGetStr(r, COL_ROUTE), routeMsg) Then
        errMsg = routeMsg
        Exit Function
    End If

    MLSet r, COL_ROUTE, NormalizeRoute(MLGetStr(r, COL_ROUTE))
    ValidateSelectedPart = True
End Function

'--- Topic 107 - approval gate --------------------------------------------------
Public Function ApprovalBlocks(ByVal r As ListRow) As Boolean
    ApprovalBlocks = (UCase$(MLGetStr(r, COL_APPROVALSTATUS)) = UCase$(AP_REJECTED))
End Function

'--- Guard used before mail work: recipients must look like addresses ----------
Public Function ValidateRecipients(ByVal toList As String, ByVal ccList As String, _
                                   ByRef errMsg As String) As Boolean
    Dim addrs As Variant, i As Long, bad As Collection, a As String

    Set bad = New Collection
    If Len(Trim$(toList)) = 0 Then
        errMsg = "No recipient e-mail addresses could be built from the Route." & vbCrLf & vbCrLf & _
                 "Check PROCESS_OWNER_CONFIG: every process code in the route needs an " & _
                 "Email value and Enabled = YES."
        Exit Function
    End If

    addrs = Split(toList & ";" & ccList, ";")
    For i = LBound(addrs) To UBound(addrs)
        a = Trim$(CStr(addrs(i)))
        If Len(a) > 0 Then
            If Not IsValidEmail(a) Then bad.Add a
        End If
    Next i

    If bad.Count > 0 Then
        errMsg = "Invalid e-mail address" & IIf(bad.Count > 1, "es", vbNullString) & _
                 " in PROCESS_OWNER_CONFIG:" & vbCrLf & vbCrLf & JoinCollection(bad, vbCrLf)
        Exit Function
    End If

    ValidateRecipients = True
End Function

'--- Guard used before attaching: the PDF must be real (topic 83) --------------
Public Function ValidateAttachment(ByVal pdfPath As String, ByRef errMsg As String) As Boolean
    If Len(Trim$(pdfPath)) = 0 Then
        errMsg = "PDF file not found - the PDF File Path is blank."
        Exit Function
    End If
    If Not FileExists(pdfPath) Then
        errMsg = "PDF file not found:" & vbCrLf & pdfPath
        Exit Function
    End If
    If FileSizeBytes(pdfPath) <= 0 Then
        errMsg = "PDF file is empty (0 bytes):" & vbCrLf & pdfPath
        Exit Function
    End If
    If Not FileIsAccessible(pdfPath) Then
        errMsg = "PDF file is locked by another application:" & vbCrLf & pdfPath
        Exit Function
    End If
    ValidateAttachment = True
End Function
