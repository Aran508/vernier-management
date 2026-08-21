Attribute VB_Name = "modMain"
'==============================================================================
' Module      : modMain
' Purpose     : The master automation procedure and every CONTROL_PANEL button
'               entry point. RunAutomation is a restart-safe state machine: it
'               reads MASTER_LIST, works out where the part stands and continues
'               from the first incomplete stage.
'               Topics 46, 47, 48, 55, 61, 62, 67, 71, 90, 114, 117.
'==============================================================================
Option Explicit

Private Const STEP_ROUTE  As Long = 1
Private Const STEP_FOLDER As Long = 2
Private Const STEP_EXCEL  As Long = 3
Private Const STEP_DWG    As Long = 4
Private Const STEP_EDIT   As Long = 5
Private Const STEP_PDF    As Long = 6
Private Const STEP_MAILOK As Long = 7
Private Const STEP_MAIL   As Long = 8
Private Const STEP_FINAL  As Long = 9
Private Const STEP_COUNT  As Long = 9

Private mDone(1 To STEP_COUNT) As Boolean
Private mLabel(1 To STEP_COUNT) As String

'==============================================================================
' Topics 61 / 114 - RunAutomation
'==============================================================================
Public Sub RunAutomation()
    Dim r As ListRow
    Dim msg As String
    Dim currentStep As String

    On Error GoTo ErrorHandler

    InitProgressLabels

    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub

    Application.EnableEvents = False
    UpdateAutomationStatus r, ST_RUNNING, ACT_RUN, RES_INFO
    LogRowAction r, ACT_RUN, vbNullString, ST_RUNNING, RES_INFO, _
                 "State on entry: " & StateName(GetPartState(r))

    '--------------------------------------------------------------- 1. Validate
    SetStatusBar "Validating " & MLGetStr(r, COL_PARTNO) & " ..."
    If Not ValidateSelectedPart(r, msg) Then
        MLSet r, COL_ERRORSTATUS, "ERROR"
        MLSet r, COL_ERRORMSG, Replace$(msg, vbCrLf, " ")
        UpdateAutomationStatus r, ST_ERROR, ACT_VALIDATE, RES_FAIL, msg
        ShowProgress r, "Validation failed"
        ErrorBox msg
        GoTo Finished
    End If
    mDone(STEP_ROUTE) = True

    '--------------------------------------------- 2. Route OK gate (topic 10)
    If Not IsYes(MLGet(r, COL_ROUTEOK)) Then
        UpdateAutomationStatus r, ST_WAITING, ACT_RUN, RES_WAIT, "Route OK = NO"
        currentStep = "Waiting for Route OK = YES"
        GoTo Waiting
    End If

    '------------------------------------------------------- 3. Folder structure
    ReconcileFolderStatus r
    If MLGetStr(r, COL_FOLDERSTATUS) <> ST_CREATED Then
        If Not CreateProjectFolders(r, False) Then
            currentStep = "Folder structure could not be created"
            GoTo StoppedByError
        End If
    End If
    mDone(STEP_FOLDER) = True

    '---------------------------------------------------------- 4. Process Excel
    If MLGetStr(r, COL_EXCELSTATUS) <> ST_CREATED Or Not FileExists(ExcelFileFor(r)) Then
        If Not CreateProcessExcel(r, False) Then
            currentStep = "Process Excel could not be created"
            GoTo StoppedByError
        End If
    End If
    mDone(STEP_EXCEL) = True

    '------------------------------------------------------- 5. AutoCAD drawing
    If (MLGetStr(r, COL_DWGSTATUS) <> ST_CREATED And MLGetStr(r, COL_DWGSTATUS) <> ST_EDITED) _
       Or Not FileExists(DwgFileFor(r)) Then
        If Not CreateAutoCADDrawing(r, False, False) Then
            currentStep = "AutoCAD drawing could not be created"
            GoTo StoppedByError
        End If
    End If
    mDone(STEP_DWG) = True

    ' Engineer editing is optional - the step is only "done" once it happened.
    mDone(STEP_EDIT) = (MLGetStr(r, COL_DWGSTATUS) = ST_EDITED)

    ' Topic 103 - a drawing newer than the PDF forces a new PDF.
    ApplyChangeDetection r

    '--------------------------------------------- 6. PDF approval gate (26/48)
    If MLGetStr(r, COL_PDFSTATUS) <> ST_CREATED Then
        If Not IsYes(MLGet(r, COL_PDFOK)) Then
            UpdatePDFStatus r, ST_WAITING, ACT_PDF, RES_WAIT, "PDF OK = NO"
            UpdateAutomationStatus r, ST_WAITING, ACT_RUN, RES_WAIT
            currentStep = "Waiting for PDF OK = YES"
            GoTo Waiting
        End If

        If Not ConvertDWGToPDF(r, False, False) Then
            currentStep = "PDF could not be created"
            GoTo StoppedByError
        End If
    End If
    mDone(STEP_PDF) = True

    '----------------------------------------------- 7. Mail Required (topic 29)
    If Not IsYes(MLGet(r, COL_MAILREQUIRED)) Then
        UpdateMailStatus r, ST_SKIPPED, ACT_MAILPREP, RES_SKIP, "Mail Required = NO"
        mDone(STEP_MAILOK) = True
        mDone(STEP_MAIL) = True
        GoTo Finalise
    End If

    '--------------------------------------------------- 8. Mail approval gate
    If MLGetStr(r, COL_MAILSTATUS) <> ST_SENT Then
        If Not IsYes(MLGet(r, COL_MAILOK)) Then
            UpdateMailStatus r, ST_WAITING, ACT_MAILPREP, RES_WAIT, "Mail OK = NO"
            UpdateAutomationStatus r, ST_WAITING, ACT_RUN, RES_WAIT
            currentStep = "Waiting for Mail OK = YES"
            GoTo Waiting
        End If
        mDone(STEP_MAILOK) = True

        ' Topic 62 - an already prepared draft is not rebuilt behind the
        ' operator's back; RUN AUTOMATION never resends.
        If MLGetStr(r, COL_MAILSTATUS) = ST_READY Then
            currentStep = "E-mail prepared - send it in Outlook, then MARK MAIL AS SENT"
            UpdateAutomationStatus r, ST_WAITING, ACT_RUN, RES_WAIT
            GoTo Waiting
        End If

        If Not PrepareAndSendMail(r, False, True) Then
            currentStep = "The Outlook message could not be prepared"
            GoTo StoppedByError
        End If

        If MLGetStr(r, COL_MAILSTATUS) <> ST_SENT Then
            mDone(STEP_MAILOK) = True
            currentStep = IIf(EmailSendMode() = "SEND", _
                              "Mail could not be confirmed as sent", _
                              "E-mail displayed in Outlook - send it, then MARK MAIL AS SENT")
            UpdateAutomationStatus r, ST_WAITING, ACT_RUN, RES_WAIT
            GoTo Waiting
        End If
    End If
    mDone(STEP_MAILOK) = True
    mDone(STEP_MAIL) = True

Finalise:
    '------------------------------------------------------ 9. Final status
    If UpdateFinalStatus(r) Then
        mDone(STEP_FINAL) = True
        currentStep = "AUTOMATION COMPLETE"
    Else
        currentStep = CurrentStatusText(r)
    End If
    ShowProgress r, currentStep
    GoTo Finished

Waiting:
    ShowProgress r, currentStep
    GoTo Finished

StoppedByError:
    ShowProgress r, currentStep & vbCrLf & MLGetStr(r, COL_ERRORMSG)
    GoTo Finished

Finished:
    SetStatusBar vbNullString
    Application.EnableEvents = True
    RefreshPathColumns r
    modDashboard.RefreshDashboard
    Exit Sub

ErrorHandler:
    SetStatusBar vbNullString
    Application.EnableEvents = True
    RecordError r, ACT_RUN, ErrText("modMain.RunAutomation")
    modDashboard.RefreshDashboard
End Sub

'==============================================================================
' Topic 56 - progress display
'==============================================================================
Private Sub InitProgressLabels()
    Dim i As Long
    For i = 1 To STEP_COUNT
        mDone(i) = False
    Next i
    mLabel(STEP_ROUTE) = "Route validated"
    mLabel(STEP_FOLDER) = "Folder structure created"
    mLabel(STEP_EXCEL) = "Process Excel created"
    mLabel(STEP_DWG) = "AutoCAD DWG created"
    mLabel(STEP_EDIT) = "Engineer editing completed"
    mLabel(STEP_PDF) = "PDF created"
    mLabel(STEP_MAILOK) = "Mail approval"
    mLabel(STEP_MAIL) = "Outlook e-mail"
    mLabel(STEP_FINAL) = "Final status"
End Sub

Private Function ProgressText() As String
    Dim i As Long, s As String
    For i = 1 To STEP_COUNT
        s = s & "[" & IIf(mDone(i), "X", " ") & "] " & mLabel(i) & vbCrLf
    Next i
    ProgressText = s
End Function

Private Sub ShowProgress(ByVal r As ListRow, ByVal currentStep As String)
    Dim body As String
    body = SYS_SHORT & " AUTOMATION" & vbCrLf & vbCrLf & _
           "Part Number : " & MLGetStr(r, COL_PARTNO) & vbCrLf & _
           "Revision    : " & MLGetStr(r, COL_REVISION) & vbCrLf & _
           "Route       : " & MLGetStr(r, COL_ROUTE) & vbCrLf & vbCrLf & _
           ProgressText() & vbCrLf & _
           "CURRENT STEP:" & vbCrLf & currentStep

    modDashboard.WriteProgress body

    If MLGetStr(r, COL_AUTOSTATUS) = ST_ERROR Then
        MsgBox body, vbExclamation, SYS_SHORT & " - Automation stopped"
    Else
        MsgBox body, vbInformation, SYS_SHORT & " - Automation"
    End If
End Sub

'==============================================================================
' CONTROL_PANEL button entry points (topics 55 / 67)
' Each shape on the sheet is assigned to one of these.
'==============================================================================
Public Sub btnNewPart()
    NewPart
End Sub

Public Sub btnValidateRoute()
    modRoute.ValidateRoute
End Sub

Public Sub btnRunAutomation()
    RunAutomation
End Sub

Public Sub btnCreateFolders()
    Dim r As ListRow
    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub
    Dim msg As String
    If Not ValidateSelectedPart(r, msg) Then
        ErrorBox msg
        Exit Sub
    End If
    If Not IsYes(MLGet(r, COL_ROUTEOK)) Then
        InfoBox "Route OK is not YES - nothing was created." & vbCrLf & vbCrLf & _
                "Set Route OK = YES in MASTER_LIST first."
        Exit Sub
    End If
    CreateProjectFolders r, True
    modDashboard.RefreshDashboard
End Sub

Public Sub btnCreateProcessExcel()
    Dim r As ListRow, msg As String
    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub
    If Not ValidateSelectedPart(r, msg) Then
        ErrorBox msg
        Exit Sub
    End If
    ReconcileFolderStatus r
    If MLGetStr(r, COL_FOLDERSTATUS) <> ST_CREATED Then
        If Not CreateProjectFolders(r, False) Then Exit Sub
    End If
    CreateProcessExcel r, True
    modDashboard.RefreshDashboard
End Sub

Public Sub btnCreateAutoCADDWG()
    Dim r As ListRow, msg As String
    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub
    If Not ValidateSelectedPart(r, msg) Then
        ErrorBox msg
        Exit Sub
    End If
    If MLGetStr(r, COL_EXCELSTATUS) <> ST_CREATED Then
        If Not CreateProcessExcel(r, False) Then Exit Sub
    End If
    CreateAutoCADDrawing r, True, False
    modDashboard.RefreshDashboard
End Sub

Public Sub btnOpenDWG()
    modAutoCAD.OpenDWGFile
End Sub

Public Sub btnMarkDWGAsEdited()
    modAutoCAD.MarkDWGAsEdited True
End Sub

Public Sub btnConvertToPDF()
    Dim r As ListRow
    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub
    ConvertDWGToPDF r, True, False
    UpdateFinalStatus r
    modDashboard.RefreshDashboard
End Sub

Public Sub btnSendPDF()
    modMail.SendPDF
End Sub

Public Sub btnMarkMailAsSent()
    modMail.MarkMailAsSent True
End Sub

Public Sub btnMailCancelled()
    modMail.MarkMailCancelled
End Sub

Public Sub btnRefreshMailFields()
    modMail.RefreshMailFields
End Sub

Public Sub btnOpenProjectFolder()
    modFolder.OpenProjectFolder
End Sub

Public Sub btnOpenExcel()
    modProcessExcel.OpenProcessExcel
End Sub

Public Sub btnOpenPDF()
    modPDF.OpenPDFFile
End Sub

Public Sub btnResetReprocess()
    ResetForReprocess
End Sub

Public Sub btnSearch()
    modDashboard.RunSearch
End Sub

Public Sub btnRefreshDashboard()
    modDashboard.RefreshDashboard
    InfoBox "Dashboard refreshed."
End Sub

Public Sub btnSelectPartFromList()
    modDashboard.SelectPartFromSearchResults
End Sub

'==============================================================================
' Topic 71 - NEW PART
' Uses frmAutomation when it has been imported; otherwise falls back to a
' guided sequence of prompts so the system is fully usable without the form.
'==============================================================================
Public Sub NewPart()
    If ShowAutomationForm() Then Exit Sub
    NewPartByPrompt
End Sub

'--- Late-bound so the project still compiles if the form was not imported ----
Public Function ShowAutomationForm() As Boolean
    Dim f As Object
    On Error GoTo NoForm
    Set f = VBA.UserForms.Add("frmAutomation")
    If f Is Nothing Then GoTo NoForm
    f.Show
    ShowAutomationForm = True
    Exit Function
NoForm:
    Err.Clear
    ShowAutomationForm = False
End Function

Public Sub NewPartByPrompt()
    Dim pn As String, rev As String, cust As String, route As String
    Dim proj As String, tpl As String
    Dim mailReq As String
    Dim r As ListRow
    Dim msg As String

    pn = Trim$(InputBox("Part Number:", SYS_SHORT & " - New Part"))
    If Len(pn) = 0 Then Exit Sub

    rev = Trim$(InputBox("Revision:", SYS_SHORT & " - New Part", "A"))
    If Len(rev) = 0 Then Exit Sub

    If PartExists(pn, rev) Then
        WarnBox "Part Number " & pn & " Revision " & rev & " already exists in MASTER_LIST."
        Exit Sub
    End If

    cust = Trim$(InputBox("Customer:", SYS_SHORT & " - New Part"))
    route = Trim$(InputBox("Route (process codes separated by '-')" & vbCrLf & vbCrLf & _
                           "Valid codes:" & vbCrLf & ValidProcessCodeList(", "), _
                           SYS_SHORT & " - New Part"))
    proj = Trim$(InputBox("Project Folder:", SYS_SHORT & " - New Part", _
                          GetUserValue(USR_PROJFOLDER, GetConfigValue(CFG_PROJECTROOT, vbNullString))))
    tpl = Trim$(InputBox("DWG Template:", SYS_SHORT & " - New Part", _
                         GetConfigValue(CFG_DWGTEMPLATE, vbNullString)))
    mailReq = UCase$(Trim$(InputBox("Mail Required (YES/NO):", SYS_SHORT & " - New Part", _
                                    GetConfigValue(CFG_MAILREQDEF, YES_))))
    If mailReq <> YES_ Then mailReq = NO_

    Set r = AddPartRow(pn, rev, cust, route, proj, tpl, NO_, NO_, NO_, mailReq)
    SetSelectedPart pn, rev
    LogRowAction r, ACT_NEWPART, vbNullString, ST_NOTSTARTED, RES_OK

    ' Report validation problems immediately, without blocking the entry.
    If Not ValidateSelectedPart(r, msg) Then
        WarnBox "The part was added, but it is not ready to run yet:" & vbCrLf & vbCrLf & msg
    Else
        InfoBox "Part added." & vbCrLf & vbCrLf & _
                "Set Route OK = YES in MASTER_LIST, then press RUN AUTOMATION."
    End If

    modDashboard.RefreshDashboard
End Sub

'==============================================================================
' Topics 49 / 90 - RESET / REPROCESS
' Never automatic, never deletes production files.
'==============================================================================
Public Sub ResetForReprocess()
    Dim r As ListRow
    Dim answer As VbMsgBoxResult
    Dim backupNote As String

    On Error GoTo ErrorHandler

    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub

    answer = MsgBox("Are you sure you want to reprocess this part?" & vbCrLf & vbCrLf & _
                    "Part Number : " & MLGetStr(r, COL_PARTNO) & vbCrLf & _
                    "Revision    : " & MLGetStr(r, COL_REVISION) & vbCrLf & vbCrLf & _
                    "Existing production files will NOT be deleted automatically." & vbCrLf & _
                    "Only the statuses in MASTER_LIST are reset, so the next" & vbCrLf & _
                    "RUN AUTOMATION regenerates what is missing." & vbCrLf & vbCrLf & _
                    "Continue?", _
                    vbQuestion + vbYesNo + vbDefaultButton2, SYS_SHORT & " - Reset / Reprocess")
    If answer <> vbYes Then Exit Sub

    ' Optional backup of the current production documents (topics 50 / 91).
    If AskYesNo("Create a timestamped backup of the current DWG / PDF / Excel first?" & vbCrLf & _
                vbCrLf & "They are copied into the Backup sub-folder. Nothing is deleted.") Then
        backupNote = BackupProductionFiles(r)
    End If

    MLSet r, COL_FOLDERSTATUS, ST_NOTSTARTED
    MLSet r, COL_EXCELSTATUS, ST_NOTSTARTED
    MLSet r, COL_DWGSTATUS, ST_NOTSTARTED
    MLSet r, COL_PDFSTATUS, ST_NOTSTARTED
    MLSet r, COL_MAILSTATUS, ST_NOTSTARTED
    MLSet r, COL_AUTOSTATUS, ST_NOTSTARTED
    MLSet r, COL_PDFOK, NO_
    MLSet r, COL_MAILOK, NO_
    MLSet r, COL_ERRORSTATUS, vbNullString
    MLSet r, COL_ERRORMSG, vbNullString
    MLSet r, COL_MAILERROR, vbNullString
    MLTouch r, ACT_RESET

    LogRowAction r, ACT_RESET, vbNullString, ST_NOTSTARTED, RES_OK, backupNote

    InfoBox "Statuses reset." & vbCrLf & vbCrLf & _
            IIf(Len(backupNote) > 0, backupNote & vbCrLf & vbCrLf, vbNullString) & _
            "Existing files are still on disk and will be reused unless you" & vbCrLf & _
            "regenerate them deliberately with REGENERATE DWG / PDF."

    modDashboard.RefreshDashboard
    Exit Sub

ErrorHandler:
    RecordError r, ACT_RESET, ErrText("modMain.ResetForReprocess")
End Sub

Public Function BackupProductionFiles(ByVal r As ListRow) As String
    Dim folder As String, n As Long, p As String
    folder = EnsureBackupFolder(r)
    If Len(folder) = 0 Then
        BackupProductionFiles = "Backup folder could not be created."
        Exit Function
    End If

    p = BackupFile(DwgFileFor(r), folder): If Len(p) > 0 Then n = n + 1
    p = BackupFile(PdfFileFor(r), folder): If Len(p) > 0 Then n = n + 1
    p = BackupFile(ExcelFileFor(r), folder): If Len(p) > 0 Then n = n + 1

    BackupProductionFiles = n & " file(s) copied to " & folder
    LogRowAction r, ACT_BACKUP, vbNullString, vbNullString, RES_OK, BackupProductionFiles
End Function

'==============================================================================
' Deliberate regeneration (kept separate from RESET so it can never happen by
' accident). Both back the current file up before replacing it.
'==============================================================================
Public Sub RegenerateDWG()
    Dim r As ListRow
    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub
    If Not AskYesNo("Regenerate the AutoCAD drawing from the template?" & vbCrLf & vbCrLf & _
                    "The current drawing is copied into the Backup folder first." & vbCrLf & _
                    "Any manual edits in the existing DWG will NOT be carried over.") Then Exit Sub
    CreateAutoCADDrawing r, True, True
    modDashboard.RefreshDashboard
End Sub

Public Sub RegeneratePDF()
    Dim r As ListRow
    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub
    If Not AskYesNo("Regenerate the PDF from the latest saved drawing?" & vbCrLf & vbCrLf & _
                    "The current PDF is copied into the Backup folder first.") Then Exit Sub
    ConvertDWGToPDF r, True, True
    UpdateFinalStatus r
    modDashboard.RefreshDashboard
End Sub

'==============================================================================
' Housekeeping used by ThisWorkbook.Open
'==============================================================================
Public Sub SystemStartup()
    On Error Resume Next
    ClearConfigCache
    ClearColumnCache
    RefreshUserSession
    modDashboard.RefreshDashboard
    SetStatusBar vbNullString
    On Error GoTo 0
End Sub
