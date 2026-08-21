Attribute VB_Name = "modStatus"
'==============================================================================
' Module      : modStatus
' Purpose     : The state machine. Determines where a part currently stands,
'               applies change detection, and owns every status write.
'               Topics 45, 46, 64, 65, 89, 103, 104, 105.
'==============================================================================
Option Explicit

'==============================================================================
' Topic 65 - reusable status updaters. Each one stamps Last Updated /
' Last Action and writes an AUTOMATION_LOG entry.
'==============================================================================
Public Sub UpdateFolderStatus(ByVal r As ListRow, ByVal newStatus As String, _
                              Optional ByVal actionName As String = ACT_FOLDER, _
                              Optional ByVal result As String = RES_OK, _
                              Optional ByVal errMsg As String = vbNullString)
    ApplyStatus r, COL_FOLDERSTATUS, newStatus, actionName, result, errMsg
End Sub

Public Sub UpdateExcelStatus(ByVal r As ListRow, ByVal newStatus As String, _
                             Optional ByVal actionName As String = ACT_EXCEL, _
                             Optional ByVal result As String = RES_OK, _
                             Optional ByVal errMsg As String = vbNullString)
    ApplyStatus r, COL_EXCELSTATUS, newStatus, actionName, result, errMsg
End Sub

Public Sub UpdateDWGStatus(ByVal r As ListRow, ByVal newStatus As String, _
                           Optional ByVal actionName As String = ACT_DWG, _
                           Optional ByVal result As String = RES_OK, _
                           Optional ByVal errMsg As String = vbNullString)
    ApplyStatus r, COL_DWGSTATUS, newStatus, actionName, result, errMsg
End Sub

Public Sub UpdatePDFStatus(ByVal r As ListRow, ByVal newStatus As String, _
                           Optional ByVal actionName As String = ACT_PDF, _
                           Optional ByVal result As String = RES_OK, _
                           Optional ByVal errMsg As String = vbNullString)
    ApplyStatus r, COL_PDFSTATUS, newStatus, actionName, result, errMsg
End Sub

Public Sub UpdateMailStatus(ByVal r As ListRow, ByVal newStatus As String, _
                            Optional ByVal actionName As String = ACT_MAILPREP, _
                            Optional ByVal result As String = RES_OK, _
                            Optional ByVal errMsg As String = vbNullString)
    ApplyStatus r, COL_MAILSTATUS, newStatus, actionName, result, errMsg
End Sub

Public Sub UpdateAutomationStatus(ByVal r As ListRow, ByVal newStatus As String, _
                                  Optional ByVal actionName As String = ACT_RUN, _
                                  Optional ByVal result As String = RES_INFO, _
                                  Optional ByVal errMsg As String = vbNullString)
    ApplyStatus r, COL_AUTOSTATUS, newStatus, actionName, result, errMsg
End Sub

Private Sub ApplyStatus(ByVal r As ListRow, ByVal statusColumn As String, _
                        ByVal newStatus As String, ByVal actionName As String, _
                        ByVal result As String, ByVal errMsg As String)
    Dim prev As String
    If r Is Nothing Then Exit Sub
    prev = MLGetStr(r, statusColumn)
    MLSet r, statusColumn, newStatus
    MLTouch r, actionName
    If prev <> newStatus Or result <> RES_OK Then
        LogRowAction r, actionName & " [" & statusColumn & "]", prev, newStatus, result, errMsg
    End If
End Sub

'==============================================================================
' Topics 103 / 104 - change detection.
' A DWG edited after the PDF was made invalidates the PDF; a PDF made after the
' mail was sent invalidates the mail approval.
'==============================================================================
Public Sub ApplyChangeDetection(ByVal r As ListRow)
    Dim dwgEdited As Date, dwgCreated As Date, pdfCreated As Date, mailSent As Date
    Dim newerDwg As Date

    If r Is Nothing Then Exit Sub

    dwgCreated = MLGetDate(r, COL_DWGCREATED)
    dwgEdited = MLGetDate(r, COL_DWGEDITED)
    pdfCreated = MLGetDate(r, COL_PDFCREATED)
    mailSent = MLGetDate(r, COL_MAILSENTDATE)

    newerDwg = dwgCreated
    If dwgEdited > newerDwg Then newerDwg = dwgEdited

    ' PDF is stale -> back to Waiting, PDF OK must be granted again.
    If pdfCreated > 0 And newerDwg > pdfCreated Then
        If MLGetStr(r, COL_PDFSTATUS) <> ST_WAITING Then
            MLSet r, COL_PDFOK, NO_
            UpdatePDFStatus r, ST_WAITING, ACT_PDF, RES_WAIT, _
                            "DWG changed after the PDF was produced - a new PDF is required."
        End If
    End If

    ' Mail is stale -> back to Waiting, Mail OK must be granted again.
    If pdfCreated > 0 Then
        If mailSent > 0 And pdfCreated > mailSent Then
            If MLGetStr(r, COL_MAILSTATUS) <> ST_WAITING Then
                MLSet r, COL_MAILOK, NO_
                UpdateMailStatus r, ST_WAITING, ACT_MAILPREP, RES_WAIT, _
                                 "A newer PDF was generated after the last e-mail - re-approval required."
            End If
        End If
    End If
End Sub

'--- Topic 104: a freshly produced PDF invalidates a prepared or sent e-mail.
'    Called by modPDF only when a PDF was really plotted, never when an
'    up-to-date PDF was simply reused.
Public Sub InvalidateMailForNewPDF(ByVal r As ListRow)
    Dim s As String
    If r Is Nothing Then Exit Sub
    s = MLGetStr(r, COL_MAILSTATUS)
    If s = ST_READY Or s = ST_SENT Then
        MLSet r, COL_MAILOK, NO_
        UpdateMailStatus r, ST_WAITING, ACT_MAILPREP, RES_WAIT, _
                         "A new PDF was generated - Mail OK approval is required again."
    End If
End Sub

'==============================================================================
' Topic 46 - determine the current state purely from MASTER_LIST
'==============================================================================
Public Function GetPartState(ByVal r As ListRow) As e3PState
    Dim folderS As String, excelS As String, dwgS As String
    Dim pdfS As String, mailS As String

    If r Is Nothing Then
        GetPartState = STATE_NOT_STARTED
        Exit Function
    End If

    If UCase$(MLGetStr(r, COL_ERRORSTATUS)) = "ERROR" Then
        GetPartState = STATE_ERROR
        Exit Function
    End If

    folderS = MLGetStr(r, COL_FOLDERSTATUS)
    excelS = MLGetStr(r, COL_EXCELSTATUS)
    dwgS = MLGetStr(r, COL_DWGSTATUS)
    pdfS = MLGetStr(r, COL_PDFSTATUS)
    mailS = MLGetStr(r, COL_MAILSTATUS)

    If folderS = ST_ERROR Or excelS = ST_ERROR Or dwgS = ST_ERROR _
       Or pdfS = ST_ERROR Or mailS = ST_ERROR Then
        GetPartState = STATE_ERROR
        Exit Function
    End If

    If MLGetStr(r, COL_AUTOSTATUS) = ST_COMPLETE Then
        GetPartState = STATE_COMPLETE
        Exit Function
    End If

    If Not IsYes(MLGet(r, COL_ROUTEOK)) Then
        GetPartState = STATE_NOT_STARTED
        Exit Function
    End If

    If folderS <> ST_CREATED Then
        GetPartState = STATE_ROUTE_VALIDATED
        Exit Function
    End If

    If excelS <> ST_CREATED Then
        GetPartState = STATE_FOLDER_CREATED
        Exit Function
    End If

    If dwgS <> ST_CREATED And dwgS <> ST_EDITED Then
        GetPartState = STATE_EXCEL_CREATED
        Exit Function
    End If

    ' DWG exists. Engineer editing is optional, so a Created DWG that still
    ' waits for PDF approval reports "waiting for engineer / PDF approval".
    If pdfS <> ST_CREATED Then
        If Not IsYes(MLGet(r, COL_PDFOK)) Then
            If dwgS = ST_EDITED Then
                GetPartState = STATE_WAITING_PDF_APPROVAL
            Else
                GetPartState = STATE_WAITING_ENGINEER
            End If
        Else
            If dwgS = ST_EDITED Then
                GetPartState = STATE_DWG_EDITED
            Else
                GetPartState = STATE_DWG_CREATED
            End If
        End If
        Exit Function
    End If

    ' PDF is ready.
    If Not IsYes(MLGet(r, COL_MAILREQUIRED)) Then
        GetPartState = STATE_PDF_CREATED
        Exit Function
    End If

    Select Case mailS
        Case ST_SENT
            GetPartState = STATE_MAIL_SENT
        Case ST_READY
            GetPartState = STATE_MAIL_READY
        Case Else
            If IsYes(MLGet(r, COL_MAILOK)) Then
                GetPartState = STATE_PDF_CREATED
            Else
                GetPartState = STATE_WAITING_MAIL_APPROVAL
            End If
    End Select
End Function

Public Function StateName(ByVal s As e3PState) As String
    Select Case s
        Case STATE_NOT_STARTED:            StateName = "0 - Not started / waiting for Route OK"
        Case STATE_ROUTE_VALIDATED:        StateName = "1 - Route validated"
        Case STATE_FOLDER_CREATED:         StateName = "2 - Folder created"
        Case STATE_EXCEL_CREATED:          StateName = "3 - Process Excel created"
        Case STATE_DWG_CREATED:            StateName = "4 - DWG created"
        Case STATE_WAITING_ENGINEER:       StateName = "5 - Waiting for engineer editing / PDF approval"
        Case STATE_DWG_EDITED:             StateName = "6 - DWG edited"
        Case STATE_WAITING_PDF_APPROVAL:   StateName = "7 - Waiting for PDF approval"
        Case STATE_PDF_CREATED:            StateName = "8 - PDF created"
        Case STATE_WAITING_MAIL_APPROVAL:  StateName = "9 - Waiting for Mail approval"
        Case STATE_MAIL_READY:             StateName = "10 - Mail prepared, waiting to be sent"
        Case STATE_MAIL_SENT:              StateName = "11 - Mail sent"
        Case STATE_COMPLETE:               StateName = "12 - Automation complete"
        Case Else:                         StateName = "ERROR"
    End Select
End Function

'--- Plain-language "what is this part waiting for" ----------------------------
Public Function CurrentStatusText(ByVal r As ListRow) As String
    Dim s As e3PState
    If r Is Nothing Then
        CurrentStatusText = "No part selected"
        Exit Function
    End If
    s = GetPartState(r)
    Select Case s
        Case STATE_ERROR:                 CurrentStatusText = "ERROR - " & MLGetStr(r, COL_ERRORMSG)
        Case STATE_NOT_STARTED:           CurrentStatusText = "Waiting for Route OK = YES"
        Case STATE_ROUTE_VALIDATED:       CurrentStatusText = "Ready to create folder structure"
        Case STATE_FOLDER_CREATED:        CurrentStatusText = "Ready to create Process Excel"
        Case STATE_EXCEL_CREATED:         CurrentStatusText = "Ready to create AutoCAD DWG"
        Case STATE_DWG_CREATED:           CurrentStatusText = "Ready to convert DWG to PDF"
        Case STATE_WAITING_ENGINEER:      CurrentStatusText = "Waiting for engineer editing / PDF OK = YES"
        Case STATE_DWG_EDITED:            CurrentStatusText = "DWG edited - ready to convert to PDF"
        Case STATE_WAITING_PDF_APPROVAL:  CurrentStatusText = "Waiting for PDF OK = YES"
        Case STATE_PDF_CREATED:           CurrentStatusText = "PDF created - ready to prepare the e-mail"
        Case STATE_WAITING_MAIL_APPROVAL: CurrentStatusText = "Waiting for Mail OK = YES"
        Case STATE_MAIL_READY:            CurrentStatusText = "E-mail prepared - send it, then MARK MAIL AS SENT"
        Case STATE_MAIL_SENT:             CurrentStatusText = "Mail sent - finalising"
        Case STATE_COMPLETE:              CurrentStatusText = "Automation complete"
    End Select
End Function

'==============================================================================
' Topics 45 / 89 / 105 - final status
'==============================================================================
Public Function UpdateFinalStatus(ByVal r As ListRow) As Boolean
    Dim folderOK As Boolean, excelOK As Boolean, dwgOK As Boolean
    Dim pdfOK As Boolean, mailOK As Boolean, mailNeeded As Boolean
    Dim dwgS As String

    If r Is Nothing Then Exit Function

    dwgS = MLGetStr(r, COL_DWGSTATUS)
    folderOK = (MLGetStr(r, COL_FOLDERSTATUS) = ST_CREATED)
    excelOK = (MLGetStr(r, COL_EXCELSTATUS) = ST_CREATED)
    dwgOK = (dwgS = ST_CREATED Or dwgS = ST_EDITED)
    pdfOK = (MLGetStr(r, COL_PDFSTATUS) = ST_CREATED)
    mailNeeded = IsYes(MLGet(r, COL_MAILREQUIRED))

    If mailNeeded Then
        mailOK = (MLGetStr(r, COL_MAILSTATUS) = ST_SENT)
    Else
        If MLGetStr(r, COL_MAILSTATUS) <> ST_SENT Then
            UpdateMailStatus r, ST_SKIPPED, ACT_FINAL, RES_SKIP, _
                             "Mail Required = NO"
        End If
        mailOK = True
    End If

    If folderOK And excelOK And dwgOK And pdfOK And mailOK Then
        UpdateAutomationStatus r, ST_COMPLETE, ACT_FINAL, RES_OK
        ' Topic 105 - the release date is stamped once and left alone.
        MLSetIfBlank r, COL_RELEASEDATE, Now
        ClearError r
        UpdateFinalStatus = True
    Else
        If MLGetStr(r, COL_AUTOSTATUS) <> ST_ERROR Then
            UpdateAutomationStatus r, ST_WAITING, ACT_FINAL, RES_WAIT
        End If
    End If
End Function

'--- Recalculate every derived status without touching files (safe refresh) ----
Public Sub RefreshPartStatuses(ByVal r As ListRow)
    If r Is Nothing Then Exit Sub
    RefreshPathColumns r
    ApplyChangeDetection r
    UpdateFinalStatus r
End Sub
