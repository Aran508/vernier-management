Attribute VB_Name = "modOutlook"
'==============================================================================
' Module      : modOutlook
' Purpose     : Thin, late-bound wrapper around the Outlook desktop object
'               model. It creates, displays and sends one MailItem and can look
'               a message up again in Sent Items so the system never has to
'               guess whether an e-mail really went out.
'               Topics 37, 38, 42, 43, 80, 82, 86.
'==============================================================================
Option Explicit

Private Const olMailItem As Long = 0
Private Const olFolderSentMail As Long = 5

Private mOutlook As Object

'==============================================================================
' Connection
'==============================================================================
Public Function GetOutlookApp(Optional ByVal startIfMissing As Boolean = True) As Object
    Dim probe As String

    If Not mOutlook Is Nothing Then
        On Error Resume Next
        probe = mOutlook.Name
        If Err.Number <> 0 Then
            Err.Clear
            Set mOutlook = Nothing
        End If
        On Error GoTo 0
    End If

    If Not mOutlook Is Nothing Then
        Set GetOutlookApp = mOutlook
        Exit Function
    End If

    On Error Resume Next
    Set mOutlook = GetObject(, "Outlook.Application")
    On Error GoTo 0

    If mOutlook Is Nothing And startIfMissing Then
        On Error Resume Next
        Set mOutlook = CreateObject("Outlook.Application")
        On Error GoTo 0
    End If

    If mOutlook Is Nothing Then
        Fail "modOutlook.GetOutlookApp", _
             "Outlook is not available on this computer." & vbCrLf & vbCrLf & _
             "Start Microsoft Outlook and sign in, then press SEND PDF again."
    End If

    ' Make sure a MAPI session exists (Outlook may have been started by us).
    On Error Resume Next
    mOutlook.GetNamespace("MAPI").Logon vbNullString, vbNullString, False, False
    Err.Clear
    On Error GoTo 0

    Set GetOutlookApp = mOutlook
End Function

Public Sub ReleaseOutlook()
    Set mOutlook = Nothing
End Sub

'--- The signed-in user's own address, recorded as "Mail Sent By" --------------
Public Function OutlookCurrentUserAddress() As String
    Dim ns As Object
    On Error Resume Next
    Set ns = GetOutlookApp(False).GetNamespace("MAPI")
    If Not ns Is Nothing Then
        OutlookCurrentUserAddress = ns.CurrentUser.Address
        If Len(OutlookCurrentUserAddress) = 0 Then
            OutlookCurrentUserAddress = ns.CurrentUser.Name
        End If
    End If
    Err.Clear
    On Error GoTo 0
    If Len(OutlookCurrentUserAddress) = 0 Then OutlookCurrentUserAddress = CurrentUserName()
End Function

'==============================================================================
' Topic 114 - CreateOutlookMail / AttachPDF
'==============================================================================
Public Function CreateOutlookMail(ByVal toList As String, ByVal ccList As String, _
                                  ByVal subjectText As String, ByVal bodyText As String) As Object
    Dim app As Object, mail As Object

    Set app = GetOutlookApp(True)
    Set mail = app.CreateItem(olMailItem)

    mail.To = toList
    If Len(Trim$(ccList)) > 0 Then mail.CC = ccList
    mail.Subject = subjectText
    mail.BodyFormat = 1                       ' olFormatPlain - stable for engineering mail
    mail.Body = bodyText

    Set CreateOutlookMail = mail
End Function

'--- Topic 83 / 118 - attach the PDF the system located by itself --------------
Public Function AttachPDF(ByVal mail As Object, ByVal pdfPath As String) As Boolean
    Dim msg As String

    If mail Is Nothing Then Exit Function
    If Not ValidateAttachment(pdfPath, msg) Then
        Fail "modOutlook.AttachPDF", msg
    End If

    On Error GoTo AttachFailed
    mail.Attachments.Add pdfPath
    AttachPDF = (mail.Attachments.Count > 0)
    Exit Function

AttachFailed:
    Fail "modOutlook.AttachPDF", _
         "Attachment failed for:" & vbCrLf & pdfPath & vbCrLf & vbCrLf & Err.Description
End Function

'--- Topic 38 DISPLAY mode -----------------------------------------------------
Public Sub DisplayOutlookMail(ByVal mail As Object)
    If mail Is Nothing Then Exit Sub
    ' Modeless, so the operator keeps control of Excel while reviewing.
    mail.Display False
End Sub

'--- Topic 38 SEND mode. True only when Outlook accepted the send --------------
Public Function SendOutlookMail(ByVal mail As Object) As Boolean
    If mail Is Nothing Then Exit Function
    On Error GoTo SendFailed
    mail.Send
    SendOutlookMail = True
    Exit Function
SendFailed:
    Fail "modOutlook.SendOutlookMail", "Outlook refused to send the message: " & Err.Description
End Function

'==============================================================================
' Topic 42 / 82 - verify in Sent Items instead of assuming
' Returns the matching MailItem, or Nothing.
'==============================================================================
Public Function FindInSentItems(ByVal subjectText As String, ByVal notBefore As Date) As Object
    Dim ns As Object, sentFolder As Object, items As Object, itm As Object
    Dim i As Long, checked As Long

    On Error GoTo Done
    Set ns = GetOutlookApp(True).GetNamespace("MAPI")
    Set sentFolder = ns.GetDefaultFolder(olFolderSentMail)
    If sentFolder Is Nothing Then Exit Function

    Set items = sentFolder.Items
    items.Sort "[SentOn]", True                ' newest first

    ' Only the recent messages are inspected - Sent Items can be enormous.
    For i = 1 To items.Count
        Set itm = items.Item(i)
        checked = checked + 1
        On Error Resume Next
        If StrComp(NzTrim(itm.Subject), subjectText, vbTextCompare) = 0 Then
            If itm.SentOn >= notBefore Then
                Set FindInSentItems = itm
                On Error GoTo Done
                Exit Function
            End If
        End If
        If itm.SentOn > 0 And itm.SentOn < notBefore Then
            ' Sorted newest first - everything beyond here is older.
            On Error GoTo Done
            Exit For
        End If
        Err.Clear
        On Error GoTo Done
        If checked >= 500 Then Exit For
    Next i

Done:
    On Error GoTo 0
End Function

'--- True when Outlook can be reached without starting it ----------------------
Public Function OutlookIsRunning() As Boolean
    Dim app As Object
    On Error Resume Next
    Set app = GetObject(, "Outlook.Application")
    OutlookIsRunning = Not (app Is Nothing)
    Err.Clear
    On Error GoTo 0
End Function
