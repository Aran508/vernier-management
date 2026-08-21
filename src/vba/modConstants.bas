Attribute VB_Name = "modConstants"
'==============================================================================
' 3P 2.0 - PROCESS SHEET AUTOMATION & RELEASE MANAGEMENT SYSTEM
' Module      : modConstants
' Purpose     : Single place for every literal used across the system.
'               Sheet names, table names, column headers, status values and
'               state-machine states are declared here ONCE so that no other
'               module hard-codes a string.
'==============================================================================
Option Explicit

'--- System identity -----------------------------------------------------------
Public Const SYS_NAME       As String = "3P 2.0 - Process Sheet Automation & Release Management System"
Public Const SYS_SHORT      As String = "3P 2.0"
Public Const SYS_VERSION    As String = "2.0.0"

'--- Worksheet names -----------------------------------------------------------
Public Const SH_CONTROL     As String = "CONTROL_PANEL"
Public Const SH_MASTER      As String = "MASTER_LIST"
Public Const SH_PROCESS     As String = "PROCESS_CONFIG"
Public Const SH_OWNER       As String = "PROCESS_OWNER_CONFIG"
Public Const SH_CONFIG      As String = "CONFIG"
Public Const SH_USER        As String = "USER_CONFIG"
Public Const SH_LOG         As String = "AUTOMATION_LOG"
Public Const SH_README      As String = "README"

'--- ListObject (table) names --------------------------------------------------
Public Const TBL_MASTER     As String = "tblMaster"
Public Const TBL_PROCESS    As String = "tblProcess"
Public Const TBL_OWNER      As String = "tblOwner"
Public Const TBL_CONFIG     As String = "tblConfig"
Public Const TBL_USER       As String = "tblUser"
Public Const TBL_LOG        As String = "tblLog"

'--- MASTER_LIST column headers (tblMaster) ------------------------------------
' PART INFORMATION
Public Const COL_SNO            As String = "S.No"
Public Const COL_PARTNO         As String = "Part Number"
Public Const COL_REVISION       As String = "Revision"
Public Const COL_CUSTOMER       As String = "Customer"
Public Const COL_ROUTE          As String = "Route"
Public Const COL_PROJFOLDER     As String = "Project Folder"
Public Const COL_DWGTEMPLATE    As String = "DWG Template"
Public Const COL_DWGFOLDER      As String = "DWG Folder"
Public Const COL_XLFOLDER       As String = "Excel Folder"
Public Const COL_PDFFOLDER      As String = "PDF Folder"
Public Const COL_OTHERDETAILS   As String = "Other Details"
' APPROVAL / CONTROL
Public Const COL_ROUTEOK        As String = "Route OK"
Public Const COL_APPROVEDBY     As String = "Approved By"
Public Const COL_APPROVALSTATUS As String = "Approval Status"
Public Const COL_DIGITALSIGN    As String = "Digital Sign"
Public Const COL_RELEASEDATE    As String = "Release Date"
Public Const COL_PDFOK          As String = "PDF OK"
Public Const COL_MAILOK         As String = "Mail OK"
Public Const COL_MAILREQUIRED   As String = "Mail Required"
' AUTOMATION STATUS
Public Const COL_FOLDERSTATUS   As String = "Folder Status"
Public Const COL_EXCELSTATUS    As String = "Excel Status"
Public Const COL_DWGSTATUS      As String = "DWG Status"
Public Const COL_PDFSTATUS      As String = "PDF Status"
Public Const COL_MAILSTATUS     As String = "Mail Status"
Public Const COL_AUTOSTATUS     As String = "Automation Status"
' MAIL INFORMATION
Public Const COL_MAILTO         As String = "Mail To"
Public Const COL_MAILCC         As String = "Mail CC"
Public Const COL_MAILSUBJECT    As String = "Mail Subject"
Public Const COL_MAILATTACH     As String = "Mail Attachment Path"
Public Const COL_MAILSENTDATE   As String = "Mail Sent Date"
Public Const COL_MAILSENTBY     As String = "Mail Sent By"
Public Const COL_MAILERROR      As String = "Mail Error"
' FILE PATHS
Public Const COL_PROJECTPATH    As String = "Project Path"
Public Const COL_EXCELPATH      As String = "Excel File Path"
Public Const COL_DWGPATH        As String = "DWG File Path"
Public Const COL_PDFPATH        As String = "PDF File Path"
' TIMESTAMPS
Public Const COL_CREATEDDATE    As String = "Created Date"
Public Const COL_XLCREATED      As String = "Excel Created Date"
Public Const COL_DWGCREATED     As String = "DWG Created Date"
Public Const COL_DWGEDITED      As String = "DWG Edited Date"
Public Const COL_PDFCREATED     As String = "PDF Created Date"
Public Const COL_LASTUPDATED    As String = "Last Updated"
' ERROR / CONTROL
Public Const COL_ERRORSTATUS    As String = "Error Status"
Public Const COL_ERRORMSG       As String = "Error Message"
Public Const COL_LASTACTION     As String = "Last Action"

'--- PROCESS_CONFIG column headers ---------------------------------------------
Public Const PC_CODE        As String = "Process Code"
Public Const PC_NAME        As String = "Process Name"
Public Const PC_BLOCK       As String = "Block Name"
Public Const PC_SHEET       As String = "Excel Sheet Name"
Public Const PC_ENABLED     As String = "Enabled"
Public Const PC_X           As String = "X Position"
Public Const PC_Y           As String = "Y Position"
Public Const PC_SCALEX      As String = "Scale X"
Public Const PC_SCALEY      As String = "Scale Y"
Public Const PC_ROTATION    As String = "Rotation"
Public Const PC_DESC        As String = "Description"
Public Const PC_OWNER       As String = "Owner"

'--- PROCESS_OWNER_CONFIG column headers ---------------------------------------
Public Const OW_CODE        As String = "Process Code"
Public Const OW_NAME        As String = "Process Name"
Public Const OW_OWNER       As String = "Process Owner"
Public Const OW_EMAIL       As String = "Email"
Public Const OW_CC          As String = "CC Email"
Public Const OW_ENABLED     As String = "Enabled"

'--- AUTOMATION_LOG column headers ---------------------------------------------
Public Const LG_ID          As String = "Log ID"
Public Const LG_DATE        As String = "Date"
Public Const LG_TIME        As String = "Time"
Public Const LG_PARTNO      As String = "Part Number"
Public Const LG_REVISION    As String = "Revision"
Public Const LG_ACTION      As String = "Action"
Public Const LG_PREVSTATUS  As String = "Previous Status"
Public Const LG_NEWSTATUS   As String = "New Status"
Public Const LG_USER        As String = "User"
Public Const LG_RESULT      As String = "Result"
Public Const LG_ERROR       As String = "Error Message"
Public Const LG_MAILACTION  As String = "Mail Action"
Public Const LG_RECIPIENT   As String = "Recipient"
Public Const LG_CC          As String = "CC"
Public Const LG_SUBJECT     As String = "Subject"
Public Const LG_ATTACHMENT  As String = "Attachment"
Public Const LG_SENDSTATUS  As String = "Send Status"

'--- CONFIG keys ---------------------------------------------------------------
Public Const CFG_PROJECTROOT    As String = "Project Root Folder"
Public Const CFG_DWGTEMPLATE    As String = "Default DWG Template"
Public Const CFG_ACADAPP        As String = "AutoCAD Application"
Public Const CFG_PLOTCONFIG     As String = "PDF Plot Configuration"
Public Const CFG_PLOTPAPER      As String = "PDF Paper Size"
Public Const CFG_PLOTSTYLE      As String = "PDF Plot Style"
Public Const CFG_COMPANY        As String = "Company Name"
Public Const CFG_DEPARTMENT     As String = "Department Name"
Public Const CFG_SYSVERSION     As String = "System Version"
Public Const CFG_BLOCKSCALE     As String = "Default Block Scale"
Public Const CFG_SPACING        As String = "Default Process Spacing"
Public Const CFG_MAILMODE       As String = "Email Send Mode"
Public Const CFG_MAILDIST       As String = "Email Distribution Mode"
Public Const CFG_MAILSUBJECT    As String = "Email Subject Template"
Public Const CFG_MAILBODY       As String = "Email Body Template"
Public Const CFG_MAILREQDEF     As String = "Mail Required Default"
Public Const CFG_ALLOWDUPPROC   As String = "Allow Duplicate Process Codes"
Public Const CFG_DWGTABLEMODE   As String = "DWG Table Mode"
Public Const CFG_TABLEOFFSET    As String = "DWG Table Y Offset"
Public Const CFG_TABLEROWH      As String = "DWG Table Row Height"
Public Const CFG_TABLECOLW      As String = "DWG Table Column Width"
Public Const CFG_TABLETEXTH     As String = "DWG Table Text Height"
Public Const CFG_BACKUPENABLED  As String = "Backup Before Regenerate"
Public Const CFG_ACADVISIBLE    As String = "AutoCAD Visible"
Public Const CFG_ACADTIMEOUT    As String = "AutoCAD Ready Timeout Sec"
Public Const CFG_PLOTTIMEOUT    As String = "PDF Plot Timeout Sec"
Public Const CFG_CLOSEDWG       As String = "Close DWG After Create"
Public Const CFG_DATEFORMAT     As String = "Date Display Format"

'--- USER_CONFIG keys ----------------------------------------------------------
Public Const USR_NAME       As String = "User Name"
Public Const USR_EMPID      As String = "Employee ID"
Public Const USR_DEPT       As String = "Department"
Public Const USR_ROLE       As String = "Role"
Public Const USR_MACHINE    As String = "Computer Name"
Public Const USR_LASTLOGIN  As String = "Last Login"
Public Const USR_PROJFOLDER As String = "Default Project Folder"
Public Const USR_ENABLED    As String = "Enabled"

'--- CONTROL_PANEL named ranges ------------------------------------------------
Public Const NR_SELPART     As String = "rngSelectedPart"
Public Const NR_SELREV      As String = "rngSelectedRev"
Public Const NR_SEARCH      As String = "rngSearchText"
Public Const NR_SEARCHFIELD As String = "rngSearchField"
Public Const NR_PROGRESS    As String = "rngProgress"

'--- Status values -------------------------------------------------------------
Public Const ST_NOTSTARTED  As String = "Not Started"
Public Const ST_WAITING     As String = "Waiting"
Public Const ST_RUNNING     As String = "Running"
Public Const ST_CREATED     As String = "Created"
Public Const ST_EDITED      As String = "Edited"
Public Const ST_READY       As String = "Ready"
Public Const ST_SENT        As String = "Sent"
Public Const ST_SKIPPED     As String = "Skipped"
Public Const ST_COMPLETE    As String = "Complete"
Public Const ST_ERROR       As String = "Error"

Public Const YES_           As String = "YES"
Public Const NO_            As String = "NO"

Public Const AP_PENDING     As String = "Pending"
Public Const AP_APPROVED    As String = "Approved"
Public Const AP_REJECTED    As String = "Rejected"

'--- State machine (topic 46) --------------------------------------------------
Public Enum e3PState
    STATE_NOT_STARTED = 0
    STATE_ROUTE_VALIDATED = 1
    STATE_FOLDER_CREATED = 2
    STATE_EXCEL_CREATED = 3
    STATE_DWG_CREATED = 4
    STATE_WAITING_ENGINEER = 5
    STATE_DWG_EDITED = 6
    STATE_WAITING_PDF_APPROVAL = 7
    STATE_PDF_CREATED = 8
    STATE_WAITING_MAIL_APPROVAL = 9
    STATE_MAIL_READY = 10
    STATE_MAIL_SENT = 11
    STATE_COMPLETE = 12
    STATE_ERROR = 99
End Enum

'--- Action names used for logging / Last Action -------------------------------
Public Const ACT_VALIDATE   As String = "Validate Route"
Public Const ACT_FOLDER     As String = "Create Folder Structure"
Public Const ACT_EXCEL      As String = "Create Process Excel"
Public Const ACT_DWG        As String = "Create AutoCAD DWG"
Public Const ACT_DWGEDIT    As String = "Mark DWG As Edited"
Public Const ACT_PDF        As String = "Convert DWG To PDF"
Public Const ACT_MAILPREP   As String = "Prepare Outlook Mail"
Public Const ACT_MAILSEND   As String = "Send Outlook Mail"
Public Const ACT_MAILMARK   As String = "Mark Mail As Sent"
Public Const ACT_RUN        As String = "Run Automation"
Public Const ACT_NEWPART    As String = "New Part"
Public Const ACT_RESET      As String = "Reset / Reprocess"
Public Const ACT_FINAL      As String = "Final Status Update"
Public Const ACT_BACKUP     As String = "Backup"

'--- Result values used for logging --------------------------------------------
Public Const RES_OK         As String = "OK"
Public Const RES_FAIL       As String = "FAILED"
Public Const RES_SKIP       As String = "SKIPPED"
Public Const RES_WAIT       As String = "WAITING"
Public Const RES_INFO       As String = "INFO"

'--- Sub-folder names ----------------------------------------------------------
Public Const FLD_DWG        As String = "DWG"
Public Const FLD_EXCEL      As String = "Excel"
Public Const FLD_PDF        As String = "PDF"
Public Const FLD_BACKUP     As String = "Backup"
