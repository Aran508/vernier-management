Attribute VB_Name = "modMail"
'==============================================================================
' Module      : modMail
' Purpose     : Stage 10 - the Outlook PDF distribution stage.
'               Recipients come from the Route via PROCESS_OWNER_CONFIG, the
'               PDF is located from the folder structure, and the mail status
'               only ever says "Sent" when a message really was sent.
'               Topics 28-44, 75-86, 104, 118, 119.
'==============================================================================
Option Explicit

'==============================================================================
' Topic 114 - BuildRecipientList
' Fills toList / ccList from the route. Duplicates are removed, and an address
' that is already in To is never repeated in CC (topics 32, 34, 77).
'==============================================================================
Public Function BuildRecipientList(ByVal r As ListRow, ByRef toList As String, _
                                   ByRef ccList As String, ByRef errMsg As String) As Boolean
    Dim codes As Collection, i As Long
    Dim o As OwnerDef
    Dim toDict As Object, ccDict As Object
    Dim missing As Collection
    Dim mode As String
    Dim addr As String, ccAddr As String
    Dim parts As Variant, j As Long

    toList = vbNullString
    ccList = vbNullString
    errMsg = vbNullString

    mode = EmailDistributionMode()

    '--- CUSTOM: whatever the operator typed in MASTER_LIST is respected -------
    If mode = "CUSTOM" Then
        toList = MLGetStr(r, COL_MAILTO)
        ccList = MLGetStr(r, COL_MAILCC)
        If Len(Trim$(toList)) = 0 Then
            errMsg = "Email Distribution Mode is CUSTOM but the Mail To column is empty." & _
                     vbCrLf & "Type the recipients in MASTER_LIST, or switch '" & CFG_MAILDIST & _
                     "' back to ALL_ROUTE_OWNERS."
            Exit Function
        End If
        BuildRecipientList = True
        Exit Function
    End If

    Set codes = ParseRoute(MLGetStr(r, COL_ROUTE))
    If codes.Count = 0 Then
        errMsg = "The route is empty, so no process owners can be identified."
        Exit Function
    End If

    '--- CURRENT_PROCESS_OWNER: only the first step of the route --------------
    If mode = "CURRENT_PROCESS_OWNER" Then
        Dim firstCode As String
        firstCode = codes(1)
        Set codes = New Collection
        codes.Add firstCode
    End If

    Set toDict = NewDictionary()
    Set ccDict = NewDictionary()
    Set missing = New Collection

    For i = 1 To codes.Count
        o = GetOwnerDef(codes(i))
        If Not o.Found Then
            missing.Add codes(i) & " (not listed in PROCESS_OWNER_CONFIG)"
        ElseIf Not o.Enabled Then
            missing.Add codes(i) & " (Enabled = NO)"
        ElseIf Len(o.Email) = 0 Then
            missing.Add codes(i) & " (no Email address)"
        Else
            ' A single cell may legitimately hold several addresses.
            parts = Split(Replace$(o.Email, ",", ";"), ";")
            For j = LBound(parts) To UBound(parts)
                addr = Trim$(CStr(parts(j)))
                If Len(addr) > 0 Then
                    If Not toDict.Exists(addr) Then toDict.Add addr, o.Code
                End If
            Next j
        End If

        If o.Found And o.Enabled And Len(o.CcEmail) > 0 Then
            parts = Split(Replace$(o.CcEmail, ",", ";"), ";")
            For j = LBound(parts) To UBound(parts)
                ccAddr = Trim$(CStr(parts(j)))
                If Len(ccAddr) > 0 Then
                    If Not ccDict.Exists(ccAddr) Then ccDict.Add ccAddr, o.Code
                End If
            Next j
        End If
    Next i

    If toDict.Count = 0 Then
        errMsg = "No process owner e-mail addresses could be found for route " & _
                 MLGetStr(r, COL_ROUTE) & "." & vbCrLf & vbCrLf & _
                 "PROCESS_OWNER_CONFIG problems:" & vbCrLf & JoinCollection(missing, vbCrLf)
        Exit Function
    End If

    ' Topic 34/77 - an address in To must not also appear in CC.
    Dim k As Variant
    For Each k In ccDict.Keys
        If toDict.Exists(CStr(k)) Then ccDict.Remove k
    Next k

    toList = JoinDictKeys(toDict, "; ")
    ccList = JoinDictKeys(ccDict, "; ")

    ' Missing owners are reported but do not block a partially addressed mail;
    ' the operator sees them before sending.
    If missing.Count > 0 Then
        errMsg = "Note: no recipient for " & JoinCollection(missing, ", ")
    End If

    BuildRecipientList = True
End Function

Private Function JoinDictKeys(ByVal d As Object, ByVal sep As String) As String
    Dim k As Variant, s As String
    For Each k In d.Keys
        If Len(s) > 0 Then s = s & sep
        s = s & CStr(k)
    Next k
    JoinDictKeys = s
End Function

'--- Topics 33 / 76 -------------------------------------------------------------
Public Function BuildMailTo(ByVal r As ListRow) As String
    Dim t As String, c As String, m As String
    If BuildRecipientList(r, t, c, m) Then BuildMailTo = t
End Function

'--- Topics 34 / 77 -------------------------------------------------------------
Public Function BuildMailCC(ByVal r As ListRow) As String
    Dim t As String, c As String, m As String
    If BuildRecipientList(r, t, c, m) Then BuildMailCC = c
End Function

'==============================================================================
' Topics 35 / 78 - subject
'==============================================================================
Public Function BuildMailSubject(ByVal r As ListRow) As String
    Dim template As String
    template = GetConfigValue(CFG_MAILSUBJECT, _
                              "3P Process Drawing Release - {PART_NUMBER} - Rev {REVISION}")
    BuildMailSubject = ApplyTokens(template, MailTokens(r))
End Function

'==============================================================================
' Topics 36 / 79 - body
'==============================================================================
Public Function BuildMailBody(ByVal r As ListRow) As String
    Dim template As String
    template = GetConfigValue(CFG_MAILBODY, DefaultBodyTemplate())
    BuildMailBody = ApplyTokens(template, MailTokens(r))
End Function

Public Function DefaultBodyTemplate() As String
    DefaultBodyTemplate = _
        "Dear Team," & vbCrLf & vbCrLf & _
        "Please find attached the approved 3P process drawing for the following part." & vbCrLf & vbCrLf & _
        "Part Number : {PART_NUMBER}" & vbCrLf & _
        "Revision    : {REVISION}" & vbCrLf & _
        "Customer    : {CUSTOMER}" & vbCrLf & _
        "Route       : {ROUTE}" & vbCrLf & _
        "Release Date: {RELEASE_DATE}" & vbCrLf & vbCrLf & _
        "The drawing has completed the required 3P automation and approval process." & vbCrLf & vbCrLf & _
        "Please review and proceed with the required process activities." & vbCrLf & vbCrLf & _
        "Regards," & vbCrLf & _
        "{USER_NAME}" & vbCrLf & _
        "{DEPARTMENT}"
End Function

Private Function MailTokens(ByVal r As ListRow) As Object
    Dim d As Object, releaseDate As Date
    Set d = NewDictionary()

    releaseDate = MLGetDate(r, COL_RELEASEDATE)
    If releaseDate = 0 Then releaseDate = MLGetDate(r, COL_PDFCREATED)
    If releaseDate = 0 Then releaseDate = Now

    d("PART_NUMBER") = MLGetStr(r, COL_PARTNO)
    d("REVISION") = MLGetStr(r, COL_REVISION)
    d("CUSTOMER") = MLGetStr(r, COL_CUSTOMER)
    d("ROUTE") = MLGetStr(r, COL_ROUTE)
    d("RELEASE_DATE") = Format$(releaseDate, GetConfigValue(CFG_DATEFORMAT, "dd-mmm-yyyy"))
    d("DATE") = Format$(Date, GetConfigValue(CFG_DATEFORMAT, "dd-mmm-yyyy"))
    d("USER_NAME") = CurrentUserName()
    d("EMPLOYEE_ID") = GetUserValue(USR_EMPID, vbNullString)
    d("DEPARTMENT") = CurrentDepartment()
    d("COMPANY") = GetConfigValue(CFG_COMPANY, vbNullString)
    d("APPROVED_BY") = MLGetStr(r, COL_APPROVEDBY)
    d("PDF_NAME") = SafePartName(r) & ".pdf"
    d("PDF_PATH") = PdfFileFor(r)
    d("OTHER_DETAILS") = MLGetStr(r, COL_OTHERDETAILS)

    Set MailTokens = d
End Function

'==============================================================================
' Topics 40 / 84 - the SEND PDF operation
'==============================================================================
Public Function PrepareAndSendMail(ByVal r As ListRow, _
                                   Optional ByVal announce As Boolean = True, _
                                   Optional ByVal fromRunAutomation As Boolean = False) As Boolean
    Dim toList As String, ccList As String, note As String, msg As String
    Dim subjectText As String, bodyText As String, pdfPath As String
    Dim mail As Object
    Dim mode As String
    Dim isResend As Boolean
    Dim prevStatus As String

    On Error GoTo ErrorHandler

    If r Is Nothing Then Exit Function
    prevStatus = MLGetStr(r, COL_MAILSTATUS)

    '--- Topic 29 - mail may not be required at all ---------------------------
    If Not IsYes(MLGet(r, COL_MAILREQUIRED)) Then
        UpdateMailStatus r, ST_SKIPPED, ACT_MAILPREP, RES_SKIP, "Mail Required = NO"
        UpdateFinalStatus r
        If announce And Not fromRunAutomation Then
            InfoBox "Mail Required = NO for this part, so no e-mail is prepared." & vbCrLf & vbCrLf & _
                    "Mail Status = Skipped."
        End If
        PrepareAndSendMail = True
        Exit Function
    End If

    '--- Topic 39/83 - the PDF must exist before anything else ----------------
    If MLGetStr(r, COL_PDFSTATUS) <> ST_CREATED Then
        MLSet r, COL_MAILERROR, "PDF is not ready (PDF Status = " & MLGetStr(r, COL_PDFSTATUS) & ")"
        UpdateMailStatus r, ST_WAITING, ACT_MAILPREP, RES_WAIT, MLGetStr(r, COL_MAILERROR)
        If announce Then
            WarnBox "The PDF for this part is not ready yet." & vbCrLf & vbCrLf & _
                    "PDF Status = " & MLGetStr(r, COL_PDFSTATUS) & vbCrLf & vbCrLf & _
                    "Create the PDF before sending it."
        End If
        Exit Function
    End If

    pdfPath = PdfFileFor(r)
    If Not ValidateAttachment(pdfPath, msg) Then
        MLSet r, COL_MAILERROR, msg
        UpdateMailStatus r, ST_ERROR, ACT_MAILPREP, RES_FAIL, msg
        LogMailAction r, ACT_MAILPREP, RES_FAIL, vbNullString, vbNullString, vbNullString, _
                      pdfPath, ST_ERROR, msg
        If announce Then ErrorBox msg
        Exit Function
    End If

    '--- Topic 28 - mail approval gate ---------------------------------------
    If Not IsYes(MLGet(r, COL_MAILOK)) Then
        UpdateMailStatus r, ST_WAITING, ACT_MAILPREP, RES_WAIT, "Mail OK = NO"
        UpdateAutomationStatus r, ST_WAITING, ACT_MAILPREP, RES_WAIT
        If announce Then
            InfoBox "Mail OK is not YES for this part." & vbCrLf & vbCrLf & _
                    "Set Mail OK = YES in MASTER_LIST when the release is approved for distribution."
        End If
        Exit Function
    End If

    '--- Topics 44 / 85 - resend protection -----------------------------------
    If MLGetStr(r, COL_MAILSTATUS) = ST_SENT Then
        If fromRunAutomation Then
            ' RUN AUTOMATION never resends by itself (topic 62).
            UpdateFinalStatus r
            PrepareAndSendMail = True
            Exit Function
        End If
        If Not AskYesNo("This PDF has already been sent." & vbCrLf & vbCrLf & _
                        "Part Number : " & MLGetStr(r, COL_PARTNO) & vbCrLf & _
                        "Revision    : " & MLGetStr(r, COL_REVISION) & vbCrLf & _
                        "Sent Date   : " & FormatDateOut(MLGet(r, COL_MAILSENTDATE)) & vbCrLf & _
                        "Recipients  : " & MLGetStr(r, COL_MAILTO) & vbCrLf & vbCrLf & _
                        "Do you want to resend?") Then
            Exit Function
        End If
        isResend = True
    End If

    '--- Topics 31/75/119 - recipients from the route -------------------------
    If Not BuildRecipientList(r, toList, ccList, note) Then
        MLSet r, COL_MAILERROR, note
        UpdateMailStatus r, ST_ERROR, ACT_MAILPREP, RES_FAIL, note
        LogMailAction r, ACT_MAILPREP, RES_FAIL, vbNullString, vbNullString, vbNullString, _
                      pdfPath, ST_ERROR, note
        If announce Then ErrorBox note
        Exit Function
    End If

    If Not ValidateRecipients(toList, ccList, msg) Then
        MLSet r, COL_MAILERROR, msg
        UpdateMailStatus r, ST_ERROR, ACT_MAILPREP, RES_FAIL, msg
        LogMailAction r, ACT_MAILPREP, RES_FAIL, toList, ccList, vbNullString, pdfPath, ST_ERROR, msg
        If announce Then ErrorBox msg
        Exit Function
    End If

    subjectText = BuildMailSubject(r)
    bodyText = BuildMailBody(r)
    If isResend Then
        subjectText = "[RESEND] " & subjectText
    End If

    '--- Record what is about to be sent so the operator can review it --------
    MLSet r, COL_MAILTO, toList
    MLSet r, COL_MAILCC, ccList
    MLSet r, COL_MAILSUBJECT, subjectText
    MLSet r, COL_MAILATTACH, pdfPath
    MLSet r, COL_MAILERROR, note

    '--- Build the Outlook message -------------------------------------------
    SetStatusBar "Preparing the Outlook message ..."
    Set mail = CreateOutlookMail(toList, ccList, subjectText, bodyText)
    AttachPDF mail, pdfPath

    mode = EmailSendMode()

    If mode = "SEND" Then
        If SendOutlookMail(mail) Then
            MLSet r, COL_MAILSENTDATE, Now
            MLSet r, COL_MAILSENTBY, OutlookCurrentUserAddress()
            MLSet r, COL_MAILERROR, vbNullString
            UpdateMailStatus r, ST_SENT, ACT_MAILSEND, RES_OK
            LogMailAction r, IIf(isResend, ACT_MAILSEND & " (RESEND)", ACT_MAILSEND), RES_OK, _
                          toList, ccList, subjectText, pdfPath, ST_SENT
            ClearError r
            UpdateFinalStatus r
            If announce Then
                InfoBox "E-mail sent." & vbCrLf & vbCrLf & _
                        "To      : " & toList & vbCrLf & _
                        "CC      : " & ccList & vbCrLf & _
                        "Subject : " & subjectText & vbCrLf & _
                        "Attached: " & FSO.GetFileName(pdfPath)
            End If
        End If
    Else
        '--- Topics 38/42/82 - DISPLAY mode stops at Ready --------------------
        DisplayOutlookMail mail
        UpdateMailStatus r, ST_READY, ACT_MAILPREP, RES_OK
        MLSet r, COL_MAILERROR, note
        LogMailAction r, IIf(isResend, ACT_MAILPREP & " (RESEND)", ACT_MAILPREP), RES_OK, _
                      toList, ccList, subjectText, pdfPath, ST_READY
        UpdateAutomationStatus r, ST_WAITING, ACT_MAILPREP, RES_WAIT
        If announce Then
            InfoBox "The Outlook message has been prepared and displayed for review." & vbCrLf & vbCrLf & _
                    "To      : " & toList & vbCrLf & _
                    "CC      : " & IIf(Len(ccList) = 0, "(none)", ccList) & vbCrLf & _
                    "Subject : " & subjectText & vbCrLf & _
                    "Attached: " & FSO.GetFileName(pdfPath) & vbCrLf & vbCrLf & _
                    "Mail Status = Ready." & vbCrLf & vbCrLf & _
                    "After you press Send in Outlook, click MARK MAIL AS SENT so the" & vbCrLf & _
                    "system can verify the message in your Sent Items folder."
        End If
    End If

    Set mail = Nothing
    SetStatusBar vbNullString
    modDashboard.RefreshDashboard
    PrepareAndSendMail = True
    Exit Function

ErrorHandler:
    Dim eMsg As String
    eMsg = ErrText("modMail.PrepareAndSendMail")
    SetStatusBar vbNullString
    On Error Resume Next
    MLSet r, COL_MAILERROR, eMsg
    UpdateMailStatus r, ST_ERROR, ACT_MAILPREP, RES_FAIL, eMsg
    LogMailAction r, ACT_MAILPREP, RES_FAIL, toList, ccList, subjectText, pdfPath, ST_ERROR, eMsg
    On Error GoTo 0
    RecordError r, ACT_MAILPREP, eMsg, vbNullString, announce
End Function

'==============================================================================
' Topics 40 / 84 - the SEND PDF button
'==============================================================================
Public Sub SendPDF()
    Dim r As ListRow
    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub
    PrepareAndSendMail r, True, False
    modDashboard.RefreshDashboard
End Sub

'==============================================================================
' Topics 42 / 82 - MARK MAIL AS SENT
' The message is looked up in Outlook's Sent Items. Only when it is actually
' found - or the operator explicitly confirms - does the status become Sent.
'==============================================================================
Public Function MarkMailAsSent(Optional ByVal announce As Boolean = True) As Boolean
    Dim r As ListRow
    Dim subjectText As String
    Dim sentItem As Object
    Dim sentOn As Date
    Dim confirmed As Boolean

    On Error GoTo ErrorHandler

    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Function

    If MLGetStr(r, COL_MAILSTATUS) = ST_SENT Then
        InfoBox "This part is already recorded as Sent on " & _
                FormatDateOut(MLGet(r, COL_MAILSENTDATE)) & "."
        MarkMailAsSent = True
        Exit Function
    End If

    If MLGetStr(r, COL_MAILSTATUS) <> ST_READY Then
        WarnBox "No prepared e-mail is waiting for this part." & vbCrLf & vbCrLf & _
                "Mail Status = " & MLGetStr(r, COL_MAILSTATUS) & vbCrLf & vbCrLf & _
                "Use SEND PDF first."
        Exit Function
    End If

    subjectText = MLGetStr(r, COL_MAILSUBJECT)
    If Len(subjectText) = 0 Then subjectText = BuildMailSubject(r)

    SetStatusBar "Checking Outlook Sent Items ..."
    Set sentItem = FindInSentItems(subjectText, DateAdd("d", -14, Now))
    SetStatusBar vbNullString

    If Not sentItem Is Nothing Then
        On Error Resume Next
        sentOn = sentItem.SentOn
        Err.Clear
        On Error GoTo ErrorHandler
        If sentOn = 0 Then sentOn = Now
        confirmed = True
    Else
        ' Not found - never assume. Ask the operator.
        confirmed = AskYesNo( _
            "The message could not be found in your Outlook Sent Items folder." & vbCrLf & vbCrLf & _
            "Subject: " & subjectText & vbCrLf & vbCrLf & _
            "This normally means it has not been sent yet." & vbCrLf & vbCrLf & _
            "Do you confirm that the e-mail WAS sent?")
        sentOn = Now
    End If

    If Not confirmed Then
        MLSet r, COL_MAILERROR, "Email draft closed before sending"
        UpdateMailStatus r, ST_READY, ACT_MAILMARK, RES_WAIT, "Not confirmed as sent."
        LogMailAction r, ACT_MAILMARK, RES_WAIT, MLGetStr(r, COL_MAILTO), MLGetStr(r, COL_MAILCC), _
                      subjectText, MLGetStr(r, COL_MAILATTACH), ST_READY, _
                      "Operator did not confirm the send."
        Exit Function
    End If

    MLSet r, COL_MAILSENTDATE, sentOn
    MLSet r, COL_MAILSENTBY, OutlookCurrentUserAddress()
    MLSet r, COL_MAILERROR, vbNullString
    UpdateMailStatus r, ST_SENT, ACT_MAILMARK, RES_OK
    LogMailAction r, ACT_MAILMARK, RES_OK, MLGetStr(r, COL_MAILTO), MLGetStr(r, COL_MAILCC), _
                  subjectText, MLGetStr(r, COL_MAILATTACH), ST_SENT, _
                  IIf(sentItem Is Nothing, "Confirmed manually by the operator.", _
                                           "Verified in Outlook Sent Items.")
    ClearError r
    UpdateFinalStatus r
    modDashboard.RefreshDashboard

    If announce Then
        InfoBox "Mail Status = Sent" & vbCrLf & vbCrLf & _
                "Sent on : " & Format$(sentOn, "dd-mmm-yyyy hh:nn") & vbCrLf & _
                "Verified: " & IIf(sentItem Is Nothing, "manual confirmation", "Outlook Sent Items")
    End If

    MarkMailAsSent = True
    Exit Function

ErrorHandler:
    SetStatusBar vbNullString
    RecordError r, ACT_MAILMARK, ErrText("modMail.MarkMailAsSent"), vbNullString, announce
End Function

'==============================================================================
' Topic 43 - the operator closed the draft without sending
'==============================================================================
Public Sub MarkMailCancelled()
    Dim r As ListRow
    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub

    If MLGetStr(r, COL_MAILSTATUS) <> ST_READY Then
        WarnBox "Mail Status is '" & MLGetStr(r, COL_MAILSTATUS) & "', not Ready - nothing to cancel."
        Exit Sub
    End If

    MLSet r, COL_MAILERROR, "Email draft closed before sending"
    UpdateMailStatus r, ST_READY, ACT_MAILPREP, RES_WAIT, "Email draft closed before sending"
    LogMailAction r, ACT_MAILPREP, RES_WAIT, MLGetStr(r, COL_MAILTO), MLGetStr(r, COL_MAILCC), _
                  MLGetStr(r, COL_MAILSUBJECT), MLGetStr(r, COL_MAILATTACH), ST_READY, _
                  "Email draft closed before sending"
    InfoBox "Recorded: the draft was closed before sending." & vbCrLf & vbCrLf & _
            "Mail Status stays Ready - press SEND PDF whenever you are ready to try again."
    modDashboard.RefreshDashboard
End Sub

'==============================================================================
' Refresh the Mail To / CC / Subject columns without opening Outlook.
' Lets the operator review the recipients before pressing SEND PDF (topic 33).
'==============================================================================
Public Sub RefreshMailFields()
    Dim r As ListRow, toList As String, ccList As String, note As String
    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub

    If Not BuildRecipientList(r, toList, ccList, note) Then
        ErrorBox note
        Exit Sub
    End If

    MLSet r, COL_MAILTO, toList
    MLSet r, COL_MAILCC, ccList
    MLSet r, COL_MAILSUBJECT, BuildMailSubject(r)
    MLSet r, COL_MAILATTACH, PdfFileFor(r)
    MLTouch r, ACT_MAILPREP

    InfoBox "Recipients rebuilt from the route " & MLGetStr(r, COL_ROUTE) & ":" & vbCrLf & vbCrLf & _
            "To      : " & toList & vbCrLf & _
            "CC      : " & IIf(Len(ccList) = 0, "(none)", ccList) & vbCrLf & _
            "Subject : " & MLGetStr(r, COL_MAILSUBJECT) & vbCrLf & _
            "Attach  : " & PdfFileFor(r) & _
            IIf(Len(note) > 0, vbCrLf & vbCrLf & note, vbNullString)
End Sub
