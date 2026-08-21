Attribute VB_Name = "modBuilder"
'==============================================================================
' Module      : modBuilder
' Purpose     : One-time (and repeatable) construction of the whole workbook:
'               every sheet, table, dropdown, conditional format, KPI card,
'               named range and button.
'
'               Run BUILD_3P_WORKBOOK once after importing the modules. It is
'               safe to run again - existing sheets are rebuilt, but MASTER_LIST
'               data and the AUTOMATION_LOG are preserved unless you say
'               otherwise.
'==============================================================================
Option Explicit

Private Const C_DARKBLUE As Long = 6567967      ' RGB(31, 56, 100)
Private Const C_MIDBLUE  As Long = 12429967     ' RGB(143, 170, 189)
Private Const C_LIGHT    As Long = 15921906     ' RGB(242, 242, 242)
Private Const C_BORDER   As Long = 12566463     ' RGB(191, 191, 191)
Private Const C_GREEN    As Long = 3976753      ' RGB(49, 174, 60)

'==============================================================================
' MAIN ENTRY POINT
'==============================================================================
Private mSilent As Boolean

'--- Interactive build (normal use) -------------------------------------------
Public Sub BUILD_3P_WORKBOOK()
    Dim keepData As Boolean

    mSilent = False

    If Not AskYesNo("Build / rebuild the " & SYS_SHORT & " workbook structure?" & vbCrLf & vbCrLf & _
                    "CONTROL_PANEL, PROCESS_CONFIG, PROCESS_OWNER_CONFIG, CONFIG," & vbCrLf & _
                    "USER_CONFIG, AUTOMATION_LOG and README are (re)created." & vbCrLf & vbCrLf & _
                    "Continue?") Then Exit Sub

    keepData = True
    If TableExists(SH_MASTER, TBL_MASTER) Then
        keepData = Not AskYesNo("MASTER_LIST already exists." & vbCrLf & vbCrLf & _
                                "Do you want to ERASE the existing part data and start clean?" & _
                                vbCrLf & vbCrLf & "Choose No to keep your parts.")
    End If

    BuildAll keepData
End Sub

'--- Unattended build, used by tools\Build-3P-Workbook.ps1 ---------------------
Public Sub BUILD_3P_WORKBOOK_SILENT()
    mSilent = True
    BuildAll True
    mSilent = False
End Sub

Private Sub BuildAll(ByVal keepData As Boolean)
    On Error GoTo ErrorHandler

    FastMode True

    BuildMasterSheet keepData
    BuildProcessConfigSheet
    BuildOwnerConfigSheet
    BuildConfigSheet
    BuildUserConfigSheet
    BuildLogSheet
    BuildReadmeSheet
    BuildControlPanel
    ApplyMasterValidation
    ApplyMasterConditionalFormats
    OrderWorkbookSheets

    ClearConfigCache
    ClearColumnCache
    RefreshUserSession

    If MasterRowCount() = 0 Then AddSampleData

    modDashboard.RefreshDashboard

    FastMode False
    ThisWorkbook.Worksheets(SH_CONTROL).Activate

    If mSilent Then Exit Sub

    InfoBox SYS_NAME & vbCrLf & "Version " & SYS_VERSION & vbCrLf & vbCrLf & _
            "The workbook structure has been built." & vbCrLf & vbCrLf & _
            "Next steps:" & vbCrLf & _
            "1. CONFIG        - project root, DWG template, plot device, company details" & vbCrLf & _
            "2. PROCESS_CONFIG      - process codes, block names, positions" & vbCrLf & _
            "3. PROCESS_OWNER_CONFIG - real Outlook addresses" & vbCrLf & _
            "4. USER_CONFIG   - your name, employee ID, department" & vbCrLf & vbCrLf & _
            "Then save the workbook as " & vbCrLf & "3P_2.0_AUTOMATION.xlsm"
    Exit Sub

ErrorHandler:
    FastMode False
    If mSilent Then
        Err.Raise Err.Number, "modBuilder.BuildAll", Err.Description
    Else
        ErrorBox "The workbook could not be built." & vbCrLf & vbCrLf & _
                 ErrText("modBuilder.BuildAll")
    End If
End Sub

'==============================================================================
' Sheet helpers
'==============================================================================
Private Function EnsureSheet(ByVal sheetName As String, Optional ByVal wipe As Boolean = True) As Worksheet
    Dim ws As Worksheet
    Set ws = GetSheet(sheetName)
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ws.Name = sheetName
    ElseIf wipe Then
        ws.Cells.Clear
        DeleteShapes ws
        DeleteListObjects ws
    End If
    ws.Cells.Font.Name = "Calibri"
    ws.Cells.Font.Size = 11
    Set EnsureSheet = ws
End Function

Private Sub DeleteShapes(ByVal ws As Worksheet)
    Dim i As Long
    On Error Resume Next
    For i = ws.Shapes.Count To 1 Step -1
        ws.Shapes(i).Delete
    Next i
    On Error GoTo 0
End Sub

Private Sub DeleteListObjects(ByVal ws As Worksheet)
    Dim i As Long
    On Error Resume Next
    For i = ws.ListObjects.Count To 1 Step -1
        ws.ListObjects(i).Unlist
    Next i
    On Error GoTo 0
End Sub

'--- Write a header row and turn it into a styled table ------------------------
Private Function BuildTable(ByVal ws As Worksheet, ByVal headers As Variant, _
                            ByVal tableName As String, ByVal topRow As Long, _
                            ByVal leftCol As Long, ByVal styleName As String) As ListObject
    Dim i As Long, lo As ListObject, rng As Range

    For i = LBound(headers) To UBound(headers)
        ws.Cells(topRow, leftCol + i - LBound(headers)).Value = CStr(headers(i))
    Next i

    Set rng = ws.Range(ws.Cells(topRow, leftCol), _
                       ws.Cells(topRow + 1, leftCol + UBound(headers) - LBound(headers)))
    Set lo = ws.ListObjects.Add(xlSrcRange, rng, , xlYes)
    lo.Name = tableName
    On Error Resume Next
    lo.TableStyle = styleName
    On Error GoTo 0

    With lo.HeaderRowRange
        .Font.Bold = True
        .Font.Color = vbWhite
        .Interior.Color = C_DARKBLUE
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
        .WrapText = True
    End With
    ws.Rows(topRow).RowHeight = 32

    Set BuildTable = lo
End Function

Private Sub FillTableRows(ByVal lo As ListObject, ByVal data As Variant)
    Dim rowIdx As Long, colIdx As Long, lr As ListRow
    For rowIdx = LBound(data, 1) To UBound(data, 1)
        If rowIdx - LBound(data, 1) + 1 <= lo.ListRows.Count Then
            Set lr = lo.ListRows(rowIdx - LBound(data, 1) + 1)
        Else
            Set lr = lo.ListRows.Add
        End If
        For colIdx = LBound(data, 2) To UBound(data, 2)
            lr.Range.Cells(1, colIdx - LBound(data, 2) + 1).Value = data(rowIdx, colIdx)
        Next colIdx
    Next rowIdx
End Sub

'==============================================================================
' MASTER_LIST
'==============================================================================
Public Function MasterHeaders() As Variant
    MasterHeaders = Array( _
        COL_SNO, COL_PARTNO, COL_REVISION, COL_CUSTOMER, COL_ROUTE, COL_PROJFOLDER, _
        COL_DWGTEMPLATE, COL_DWGFOLDER, COL_XLFOLDER, COL_PDFFOLDER, COL_OTHERDETAILS, _
        COL_ROUTEOK, COL_APPROVEDBY, COL_APPROVALSTATUS, COL_DIGITALSIGN, COL_RELEASEDATE, _
        COL_PDFOK, COL_MAILOK, COL_MAILREQUIRED, _
        COL_FOLDERSTATUS, COL_EXCELSTATUS, COL_DWGSTATUS, COL_PDFSTATUS, COL_MAILSTATUS, _
        COL_AUTOSTATUS, _
        COL_MAILTO, COL_MAILCC, COL_MAILSUBJECT, COL_MAILATTACH, COL_MAILSENTDATE, _
        COL_MAILSENTBY, COL_MAILERROR, _
        COL_PROJECTPATH, COL_EXCELPATH, COL_DWGPATH, COL_PDFPATH, _
        COL_CREATEDDATE, COL_XLCREATED, COL_DWGCREATED, COL_DWGEDITED, COL_PDFCREATED, _
        COL_LASTUPDATED, _
        COL_ERRORSTATUS, COL_ERRORMSG, COL_LASTACTION)
End Function

Private Sub BuildMasterSheet(ByVal keepData As Boolean)
    Dim ws As Worksheet, lo As ListObject
    Dim savedData As Variant
    Dim hasOld As Boolean

    If keepData And TableExists(SH_MASTER, TBL_MASTER) Then
        savedData = CaptureMasterData()
        hasOld = Not IsEmpty(savedData)
    End If

    Set ws = EnsureSheet(SH_MASTER, True)
    Set lo = BuildTable(ws, MasterHeaders(), TBL_MASTER, 1, 1, "TableStyleMedium2")

    With ws
        .Columns(1).ColumnWidth = 6        ' S.No
        .Columns(2).ColumnWidth = 18       ' Part Number
        .Columns(3).ColumnWidth = 10
        .Columns(4).ColumnWidth = 22
        .Columns(5).ColumnWidth = 22
        .Columns(6).ColumnWidth = 26
        .Columns(7).ColumnWidth = 34
        .Columns(8).ColumnWidth = 12
        .Columns(9).ColumnWidth = 12
        .Columns(10).ColumnWidth = 12
        .Columns(11).ColumnWidth = 26
        .Range(.Columns(12), .Columns(19)).ColumnWidth = 14
        .Range(.Columns(20), .Columns(25)).ColumnWidth = 15
        .Range(.Columns(26), .Columns(32)).ColumnWidth = 30
        .Range(.Columns(33), .Columns(36)).ColumnWidth = 38
        .Range(.Columns(37), .Columns(42)).ColumnWidth = 19
        .Range(.Columns(43), .Columns(45)).ColumnWidth = 30
    End With

    If hasOld Then RestoreMasterData savedData

    FreezeAt ws, "C2"
End Sub

'--- Freeze panes reliably, even while ScreenUpdating is switched off ---------
Private Sub FreezeAt(ByVal ws As Worksheet, ByVal anchorCell As String)
    Dim prevUpdating As Boolean
    On Error Resume Next
    prevUpdating = Application.ScreenUpdating
    Application.ScreenUpdating = True
    ws.Activate
    ActiveWindow.FreezePanes = False
    ws.Range(anchorCell).Select
    ActiveWindow.FreezePanes = True
    ws.Range("A1").Select
    Application.ScreenUpdating = prevUpdating
    Err.Clear
    On Error GoTo 0
End Sub

'--- Capture existing rows keyed by header name so a rebuild never loses data --
Private Function CaptureMasterData() As Variant
    Dim lo As ListObject, r As ListRow, i As Long, j As Long
    Dim headers As Variant, data() As Variant
    Dim idx As Long

    Set lo = MasterTable()
    If lo.ListRows.Count = 0 Then Exit Function

    headers = MasterHeaders()
    ReDim data(1 To lo.ListRows.Count, LBound(headers) To UBound(headers))

    For i = 1 To lo.ListRows.Count
        Set r = lo.ListRows(i)
        For j = LBound(headers) To UBound(headers)
            idx = ColumnIndexOf(lo, CStr(headers(j)))
            If idx > 0 Then data(i, j) = r.Range.Cells(1, idx).Value
        Next j
    Next i

    CaptureMasterData = data
End Function

Private Sub RestoreMasterData(ByVal data As Variant)
    Dim lo As ListObject
    Set lo = MasterTable()
    ClearColumnCache
    FillTableRows lo, data
End Sub

'--- Topics 10 / 26 / 28 / 29 / 107 - the dropdowns ---------------------------
Private Sub ApplyMasterValidation()
    Dim lo As ListObject
    Set lo = MasterTable()

    AddListValidation ColumnBody(lo, COL_ROUTEOK), YES_ & "," & NO_
    AddListValidation ColumnBody(lo, COL_PDFOK), YES_ & "," & NO_
    AddListValidation ColumnBody(lo, COL_MAILOK), YES_ & "," & NO_
    AddListValidation ColumnBody(lo, COL_MAILREQUIRED), YES_ & "," & NO_
    AddListValidation ColumnBody(lo, COL_APPROVALSTATUS), _
                      AP_PENDING & "," & AP_APPROVED & "," & AP_REJECTED
    AddListValidation ColumnBody(lo, COL_FOLDERSTATUS), _
                      ST_NOTSTARTED & "," & ST_CREATED & "," & ST_ERROR
    AddListValidation ColumnBody(lo, COL_EXCELSTATUS), _
                      ST_NOTSTARTED & "," & ST_CREATED & "," & ST_ERROR
    AddListValidation ColumnBody(lo, COL_DWGSTATUS), _
                      ST_NOTSTARTED & "," & ST_CREATED & "," & ST_EDITED & "," & ST_ERROR
    AddListValidation ColumnBody(lo, COL_PDFSTATUS), _
                      ST_NOTSTARTED & "," & ST_WAITING & "," & ST_CREATED & "," & ST_ERROR
    AddListValidation ColumnBody(lo, COL_MAILSTATUS), _
                      ST_NOTSTARTED & "," & ST_WAITING & "," & ST_READY & "," & ST_SENT & _
                      "," & ST_SKIPPED & "," & ST_ERROR
    AddListValidation ColumnBody(lo, COL_AUTOSTATUS), _
                      ST_NOTSTARTED & "," & ST_WAITING & "," & ST_RUNNING & "," & _
                      ST_COMPLETE & "," & ST_ERROR
End Sub

Private Function ColumnBody(ByVal lo As ListObject, ByVal headerName As String) As Range
    Dim idx As Long
    idx = ColumnIndexOf(lo, headerName)
    If idx = 0 Then Exit Function
    If lo.ListRows.Count = 0 Then
        Set ColumnBody = lo.HeaderRowRange.Cells(1, idx).Offset(1, 0)
    Else
        Set ColumnBody = lo.ListColumns(idx).DataBodyRange
    End If
End Function

Private Sub AddListValidation(ByVal target As Range, ByVal listCsv As String)
    If target Is Nothing Then Exit Sub
    On Error Resume Next
    With target.Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Operator:=xlBetween, _
             Formula1:=listCsv
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = True
    End With
    On Error GoTo 0
End Sub

'--- Topic 51 - colour coded statuses in the sheet itself ---------------------
Private Sub ApplyMasterConditionalFormats()
    Dim lo As ListObject
    Dim cols As Variant, i As Long, rng As Range

    Set lo = MasterTable()
    cols = Array(COL_FOLDERSTATUS, COL_EXCELSTATUS, COL_DWGSTATUS, COL_PDFSTATUS, _
                 COL_MAILSTATUS, COL_AUTOSTATUS, COL_ERRORSTATUS)

    For i = LBound(cols) To UBound(cols)
        Set rng = ColumnBody(lo, CStr(cols(i)))
        If Not rng Is Nothing Then
            Set rng = rng.Resize(WorksheetFunction.Max(lo.ListRows.Count, 1) + 500, 1)
            rng.FormatConditions.Delete
            AddTextRule rng, ST_CREATED, RGB(0, 110, 60), RGB(226, 245, 231)
            AddTextRule rng, ST_EDITED, RGB(0, 110, 60), RGB(226, 245, 231)
            AddTextRule rng, ST_SENT, RGB(0, 110, 60), RGB(226, 245, 231)
            AddTextRule rng, ST_COMPLETE, RGB(0, 110, 60), RGB(212, 240, 220)
            AddTextRule rng, ST_WAITING, RGB(150, 90, 0), RGB(255, 242, 214)
            AddTextRule rng, ST_READY, RGB(150, 90, 0), RGB(255, 242, 214)
            AddTextRule rng, ST_RUNNING, RGB(20, 80, 160), RGB(222, 235, 247)
            AddTextRule rng, ST_SKIPPED, RGB(110, 110, 110), RGB(240, 240, 240)
            AddTextRule rng, ST_ERROR, RGB(160, 20, 20), RGB(255, 220, 220)
            AddTextRule rng, "ERROR", RGB(160, 20, 20), RGB(255, 220, 220)
        End If
    Next i

    ' YES / NO flags
    cols = Array(COL_ROUTEOK, COL_PDFOK, COL_MAILOK, COL_MAILREQUIRED)
    For i = LBound(cols) To UBound(cols)
        Set rng = ColumnBody(lo, CStr(cols(i)))
        If Not rng Is Nothing Then
            Set rng = rng.Resize(WorksheetFunction.Max(lo.ListRows.Count, 1) + 500, 1)
            rng.FormatConditions.Delete
            AddTextRule rng, YES_, RGB(0, 110, 60), RGB(226, 245, 231)
            AddTextRule rng, NO_, RGB(150, 90, 0), RGB(255, 242, 214)
        End If
    Next i

    Set rng = ColumnBody(lo, COL_APPROVALSTATUS)
    If Not rng Is Nothing Then
        Set rng = rng.Resize(WorksheetFunction.Max(lo.ListRows.Count, 1) + 500, 1)
        rng.FormatConditions.Delete
        AddTextRule rng, AP_APPROVED, RGB(0, 110, 60), RGB(226, 245, 231)
        AddTextRule rng, AP_PENDING, RGB(150, 90, 0), RGB(255, 242, 214)
        AddTextRule rng, AP_REJECTED, RGB(160, 20, 20), RGB(255, 220, 220)
    End If
End Sub

Private Sub AddTextRule(ByVal rng As Range, ByVal matchText As String, _
                        ByVal fontColour As Long, ByVal fillColour As Long)
    Dim fc As FormatCondition
    On Error Resume Next
    Set fc = rng.FormatConditions.Add(Type:=xlTextString, String:=matchText, _
                                      TextOperator:=xlContains)
    If fc Is Nothing Then Exit Sub
    fc.Font.Color = fontColour
    fc.Interior.Color = fillColour
    On Error GoTo 0
End Sub

'==============================================================================
' PROCESS_CONFIG (topics 17 / 73)
'==============================================================================
Private Sub BuildProcessConfigSheet()
    Dim ws As Worksheet, lo As ListObject
    Dim headers As Variant, data(1 To 5, 1 To 12) As Variant

    Set ws = EnsureSheet(SH_PROCESS, True)
    SheetTitle ws, "PROCESS_CONFIG", _
               "Master definition of every process code. Add a row to introduce a new process - no VBA change is needed."

    headers = Array(PC_CODE, PC_NAME, PC_BLOCK, PC_SHEET, PC_ENABLED, PC_X, PC_Y, _
                    PC_SCALEX, PC_SCALEY, PC_ROTATION, PC_DESC, PC_OWNER)
    Set lo = BuildTable(ws, headers, TBL_PROCESS, 4, 1, "TableStyleMedium2")

    FillProcessRow data, 1, "CT", "Cutting", "BLK_CT", "CT", 100, 100, "Raw material cut to length", "Cutting Owner"
    FillProcessRow data, 2, "FC", "Facing", "BLK_FC", "FC", 250, 100, "Facing operation on both ends", "Facing Owner"
    FillProcessRow data, 3, "CH", "Chamfer", "BLK_CH", "CH", 400, 100, "Chamfering as per drawing", "Chamfer Owner"
    FillProcessRow data, 4, "ET", "External Turning", "BLK_ET", "ET", 550, 100, "External turning to finished diameter", "Turning Owner"
    FillProcessRow data, 5, "WD", "Welding", "BLK_WD", "WD", 700, 100, "Welding as per WPS", "Welding Owner"

    FillTableRows lo, data

    ws.Columns("A").ColumnWidth = 14
    ws.Columns("B").ColumnWidth = 22
    ws.Columns("C").ColumnWidth = 16
    ws.Columns("D").ColumnWidth = 18
    ws.Columns("E").ColumnWidth = 10
    ws.Range(ws.Columns("F"), ws.Columns("J")).ColumnWidth = 11
    ws.Columns("K").ColumnWidth = 42
    ws.Columns("L").ColumnWidth = 22

    AddListValidation ColumnBody(lo, PC_ENABLED), YES_ & "," & NO_
    ws.Range("A1").Select
End Sub

Private Sub FillProcessRow(ByRef data As Variant, ByVal idx As Long, ByVal code As String, _
                           ByVal name As String, ByVal blockName As String, ByVal sheetName As String, _
                           ByVal x As Double, ByVal y As Double, ByVal description As String, _
                           ByVal owner As String)
    data(idx, 1) = code
    data(idx, 2) = name
    data(idx, 3) = blockName
    data(idx, 4) = sheetName
    data(idx, 5) = YES_
    data(idx, 6) = x
    data(idx, 7) = y
    data(idx, 8) = 1
    data(idx, 9) = 1
    data(idx, 10) = 0
    data(idx, 11) = description
    data(idx, 12) = owner
End Sub

'==============================================================================
' PROCESS_OWNER_CONFIG (topics 30 / 74)
'==============================================================================
Private Sub BuildOwnerConfigSheet()
    Dim ws As Worksheet, lo As ListObject
    Dim headers As Variant, data(1 To 5, 1 To 6) As Variant

    Set ws = EnsureSheet(SH_OWNER, True)
    SheetTitle ws, "PROCESS_OWNER_CONFIG", _
               "Recipients per process code. Replace the example addresses with real Outlook addresses - " & _
               "no e-mail address is ever hard-coded in VBA."

    headers = Array(OW_CODE, OW_NAME, OW_OWNER, OW_EMAIL, OW_CC, OW_ENABLED)
    Set lo = BuildTable(ws, headers, TBL_OWNER, 4, 1, "TableStyleMedium2")

    FillOwnerRow data, 1, "CT", "Cutting", "CT Owner", "ct.owner@company.com"
    FillOwnerRow data, 2, "FC", "Facing", "FC Owner", "fc.owner@company.com"
    FillOwnerRow data, 3, "CH", "Chamfer", "CH Owner", "ch.owner@company.com"
    FillOwnerRow data, 4, "ET", "External Turning", "ET Owner", "et.owner@company.com"
    FillOwnerRow data, 5, "WD", "Welding", "WD Owner", "wd.owner@company.com"

    FillTableRows lo, data

    ws.Columns("A").ColumnWidth = 14
    ws.Columns("B").ColumnWidth = 22
    ws.Columns("C").ColumnWidth = 24
    ws.Columns("D").ColumnWidth = 34
    ws.Columns("E").ColumnWidth = 34
    ws.Columns("F").ColumnWidth = 10

    AddListValidation ColumnBody(lo, OW_ENABLED), YES_ & "," & NO_
    ws.Range("A1").Select
End Sub

Private Sub FillOwnerRow(ByRef data As Variant, ByVal idx As Long, ByVal code As String, _
                         ByVal name As String, ByVal owner As String, ByVal email As String)
    data(idx, 1) = code
    data(idx, 2) = name
    data(idx, 3) = owner
    data(idx, 4) = email
    data(idx, 5) = vbNullString
    data(idx, 6) = YES_
End Sub

'==============================================================================
' CONFIG (topics 58 / 59 / 116)
'==============================================================================
Private Sub BuildConfigSheet()
    Dim ws As Worksheet, lo As ListObject
    Dim headers As Variant
    Dim data(1 To 27, 1 To 3) As Variant

    Set ws = EnsureSheet(SH_CONFIG, True)
    SheetTitle ws, "CONFIG", _
               "System settings. Everything an engineer may need to change lives here, never in the VBA code."

    headers = Array("Setting", "Value", "Notes")
    Set lo = BuildTable(ws, headers, TBL_CONFIG, 4, 1, "TableStyleMedium2")

    Cfg data, 1, CFG_PROJECTROOT, "D:\3P Projects", "Default project root used when MASTER_LIST leaves Project Folder blank."
    Cfg data, 2, CFG_DWGTEMPLATE, "D:\3P Templates\3P_Template.dwg", "Default AutoCAD template (MASTER_LIST can override per part)."
    Cfg data, 3, CFG_ACADAPP, "AutoCAD.Application", "COM ProgID. Use AutoCAD.Application.25 to pin a specific release."
    Cfg data, 4, CFG_PLOTCONFIG, "DWG To PDF.pc3", "Plot device used for DWG to PDF conversion."
    Cfg data, 5, CFG_PLOTPAPER, "", "Optional canonical media name, e.g. ISO_full_bleed_A3_(420.00_x_297.00_MM)."
    Cfg data, 6, CFG_PLOTSTYLE, "monochrome.ctb", "Optional plot style table. Leave blank to use the layout setting."
    Cfg data, 7, CFG_COMPANY, "COMPANY NAME", "Printed on generated process sheets and in the drawing title block."
    Cfg data, 8, CFG_DEPARTMENT, "Production Engineering Department", "Used in the e-mail signature."
    Cfg data, 9, CFG_SYSVERSION, SYS_VERSION, "Displayed on the CONTROL_PANEL and generated documents."
    Cfg data, 10, CFG_BLOCKSCALE, "1", "Fallback block scale when PROCESS_CONFIG leaves Scale X / Scale Y blank."
    Cfg data, 11, CFG_SPACING, "150", "Horizontal spacing used when a process has no X Position."
    Cfg data, 12, CFG_MAILMODE, "DISPLAY", "DISPLAY = build the mail and show it for review. SEND = send automatically."
    Cfg data, 13, CFG_MAILDIST, "ALL_ROUTE_OWNERS", "ALL_ROUTE_OWNERS | CURRENT_PROCESS_OWNER (first route step) | CUSTOM (use Mail To column)."
    Cfg data, 14, CFG_MAILSUBJECT, "3P Process Drawing Release - {PART_NUMBER} - Rev {REVISION}", _
        "Tokens: {PART_NUMBER} {REVISION} {CUSTOMER} {ROUTE} {RELEASE_DATE} {DATE} {USER_NAME} {DEPARTMENT} {COMPANY} {PDF_NAME}"
    Cfg data, 15, CFG_MAILBODY, DefaultBodyTemplate(), "Same tokens as the subject. Use \n for a line break when editing in the formula bar."
    Cfg data, 16, CFG_MAILREQDEF, YES_, "Default value of Mail Required for a new part."
    Cfg data, 17, CFG_ALLOWDUPPROC, NO_, "YES allows the same process code to appear twice in one route."
    Cfg data, 18, CFG_DWGTABLEMODE, "TABLE", "TABLE = build an AutoCAD table per process from the Excel sheet. NONE = blocks only."
    Cfg data, 19, CFG_TABLEOFFSET, "40", "Drawing units below the block insertion point where its table is placed."
    Cfg data, 20, CFG_TABLEROWH, "8", "AutoCAD table row height in drawing units."
    Cfg data, 21, CFG_TABLECOLW, "30", "AutoCAD table base column width in drawing units."
    Cfg data, 22, CFG_TABLETEXTH, "2.5", "Text height used by the MText fallback."
    Cfg data, 23, CFG_BACKUPENABLED, YES_, "Copy the current DWG / PDF into the Backup folder before regenerating."
    Cfg data, 24, CFG_ACADVISIBLE, YES_, "Show the AutoCAD window while the automation runs."
    Cfg data, 25, CFG_ACADTIMEOUT, "120", "Seconds to wait for AutoCAD to become ready."
    Cfg data, 26, CFG_PLOTTIMEOUT, "120", "Seconds to wait for the PDF file to appear."
    Cfg data, 27, CFG_CLOSEDWG, NO_, "Close the drawing in AutoCAD after it has been created / plotted."

    FillTableRows lo, data

    ws.Columns("A").ColumnWidth = 34
    ws.Columns("B").ColumnWidth = 52
    ws.Columns("C").ColumnWidth = 80
    lo.DataBodyRange.VerticalAlignment = xlTop
    lo.ListColumns(3).DataBodyRange.WrapText = True

    AddListValidation lo.ListColumns(2).DataBodyRange.Cells(12, 1), "DISPLAY,SEND"
    AddListValidation lo.ListColumns(2).DataBodyRange.Cells(13, 1), _
                      "ALL_ROUTE_OWNERS,CURRENT_PROCESS_OWNER,CUSTOM"
    AddListValidation lo.ListColumns(2).DataBodyRange.Cells(16, 1), YES_ & "," & NO_
    AddListValidation lo.ListColumns(2).DataBodyRange.Cells(17, 1), YES_ & "," & NO_
    AddListValidation lo.ListColumns(2).DataBodyRange.Cells(18, 1), "TABLE,NONE"
    AddListValidation lo.ListColumns(2).DataBodyRange.Cells(23, 1), YES_ & "," & NO_
    AddListValidation lo.ListColumns(2).DataBodyRange.Cells(24, 1), YES_ & "," & NO_
    AddListValidation lo.ListColumns(2).DataBodyRange.Cells(27, 1), YES_ & "," & NO_

    ws.Range("A1").Select
End Sub

Private Sub Cfg(ByRef data As Variant, ByVal idx As Long, ByVal keyName As String, _
                ByVal keyValue As String, ByVal notes As String)
    data(idx, 1) = keyName
    data(idx, 2) = keyValue
    data(idx, 3) = notes
End Sub

'==============================================================================
' USER_CONFIG (topics 60 / 108)
'==============================================================================
Private Sub BuildUserConfigSheet()
    Dim ws As Worksheet, lo As ListObject
    Dim headers As Variant, data(1 To 8, 1 To 3) As Variant

    Set ws = EnsureSheet(SH_USER, True)
    SheetTitle ws, "USER_CONFIG", "Details of the engineer operating the system."

    headers = Array("Setting", "Value", "Notes")
    Set lo = BuildTable(ws, headers, TBL_USER, 4, 1, "TableStyleMedium2")

    Cfg data, 1, USR_NAME, CurrentUser(), "Shown as Prepared By and in the e-mail signature."
    Cfg data, 2, USR_EMPID, "", "Employee number."
    Cfg data, 3, USR_DEPT, "Production Engineering Department", "Department shown on documents."
    Cfg data, 4, USR_ROLE, "Process Engineer", "Role of this user."
    Cfg data, 5, USR_MACHINE, CurrentMachine(), "Filled in automatically on open."
    Cfg data, 6, USR_LASTLOGIN, Format$(Now, "dd-mmm-yyyy hh:nn:ss"), "Filled in automatically on open."
    Cfg data, 7, USR_PROJFOLDER, "D:\3P Projects", "Offered as the default when adding a new part."
    Cfg data, 8, USR_ENABLED, YES_, "Set to NO to block this workstation from running the automation."

    FillTableRows lo, data

    ws.Columns("A").ColumnWidth = 26
    ws.Columns("B").ColumnWidth = 40
    ws.Columns("C").ColumnWidth = 62
    ws.Range("A1").Select
End Sub

'==============================================================================
' AUTOMATION_LOG (topic 66)
'==============================================================================
Private Sub BuildLogSheet()
    Dim ws As Worksheet, lo As ListObject
    Dim headers As Variant
    Dim keepLog As Boolean

    If TableExists(SH_LOG, TBL_LOG) Then
        If RequireTable(SH_LOG, TBL_LOG).ListRows.Count > 0 Then
            If mSilent Then Exit Sub
            keepLog = Not AskYesNo("AUTOMATION_LOG already contains entries." & vbCrLf & vbCrLf & _
                                   "Clear the log?")
            If keepLog Then Exit Sub
        End If
    End If

    Set ws = EnsureSheet(SH_LOG, True)
    SheetTitle ws, "AUTOMATION_LOG", "Every action the system performs is recorded here."

    headers = Array(LG_ID, LG_DATE, LG_TIME, LG_PARTNO, LG_REVISION, LG_ACTION, _
                    LG_PREVSTATUS, LG_NEWSTATUS, LG_USER, LG_RESULT, LG_ERROR, _
                    LG_MAILACTION, LG_RECIPIENT, LG_CC, LG_SUBJECT, LG_ATTACHMENT, LG_SENDSTATUS)
    Set lo = BuildTable(ws, headers, TBL_LOG, 4, 1, "TableStyleMedium2")

    ' Start with an empty body - LogAction appends rows.
    On Error Resume Next
    If lo.ListRows.Count > 0 Then lo.ListRows(1).Delete
    On Error GoTo 0

    ws.Columns("A").ColumnWidth = 8
    ws.Columns("B").ColumnWidth = 14
    ws.Columns("C").ColumnWidth = 11
    ws.Columns("D").ColumnWidth = 16
    ws.Columns("E").ColumnWidth = 10
    ws.Columns("F").ColumnWidth = 34
    ws.Columns("G").ColumnWidth = 14
    ws.Columns("H").ColumnWidth = 14
    ws.Columns("I").ColumnWidth = 16
    ws.Columns("J").ColumnWidth = 11
    ws.Columns("K").ColumnWidth = 60
    ws.Columns("L").ColumnWidth = 24
    ws.Columns("M").ColumnWidth = 40
    ws.Columns("N").ColumnWidth = 30
    ws.Columns("O").ColumnWidth = 44
    ws.Columns("P").ColumnWidth = 44
    ws.Columns("Q").ColumnWidth = 12

    FreezeAt ws, "A5"
End Sub

'==============================================================================
' Shared sheet furniture
'==============================================================================
Private Sub SheetTitle(ByVal ws As Worksheet, ByVal titleText As String, ByVal subtitleText As String)
    With ws.Range("A1:F1")
        .Merge
        .Value = SYS_SHORT & "  |  " & titleText
        .Font.Size = 15
        .Font.Bold = True
        .Font.Color = vbWhite
        .Interior.Color = C_DARKBLUE
        .HorizontalAlignment = xlLeft
        .IndentLevel = 1
    End With
    ws.Rows(1).RowHeight = 28
    With ws.Range("A2:F2")
        .Merge
        .Value = subtitleText
        .Font.Italic = True
        .HorizontalAlignment = xlLeft
        .IndentLevel = 1
        .WrapText = False
    End With
End Sub

Private Sub OrderWorkbookSheets()
    Dim order As Variant, i As Long, ws As Worksheet
    order = Array(SH_CONTROL, SH_MASTER, SH_PROCESS, SH_OWNER, SH_CONFIG, SH_USER, SH_LOG, SH_README)
    On Error Resume Next
    For i = LBound(order) To UBound(order)
        Set ws = GetSheet(CStr(order(i)))
        If Not ws Is Nothing Then
            If i = LBound(order) Then
                ws.Move Before:=ThisWorkbook.Worksheets(1)
            Else
                ws.Move After:=ThisWorkbook.Worksheets(CStr(order(i - 1)))
            End If
        End If
    Next i
    On Error GoTo 0
End Sub

'==============================================================================
' CONTROL_PANEL (topics 51-56, 67)
'==============================================================================
Private Sub BuildControlPanel()
    Dim ws As Worksheet
    Dim i As Long

    Set ws = EnsureSheet(SH_CONTROL, True)

    With ws
        .Columns("A").ColumnWidth = 2
        .Columns("B").ColumnWidth = 22
        .Columns("C").ColumnWidth = 46
        .Columns("D").ColumnWidth = 3
        .Columns("E").ColumnWidth = 22
        .Columns("F").ColumnWidth = 14
        .Columns("G").ColumnWidth = 26
        .Columns("H").ColumnWidth = 22
        .Columns("I").ColumnWidth = 3
        .Columns("J").ColumnWidth = 30
        .Columns("K").ColumnWidth = 3
        .Columns("L").ColumnWidth = 30
        .Columns("M").ColumnWidth = 3
        .Cells.Interior.Color = vbWhite
    End With

    '--- Title banner ---
    With ws.Range("B2:H3")
        .Merge
        .Value = SYS_SHORT & "  -  PROCESS SHEET AUTOMATION & RELEASE MANAGEMENT SYSTEM"
        .Font.Size = 18
        .Font.Bold = True
        .Font.Color = vbWhite
        .Interior.Color = C_DARKBLUE
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
    End With
    ws.Rows(2).RowHeight = 22
    ws.Rows(3).RowHeight = 22

    With ws.Range("B4:H4")
        .Merge
        .Formula = "=""" & "Excel VBA + AutoCAD 2026 + Outlook   |   " & """&" & _
                   "IFERROR(INDEX(tblConfig[Value],MATCH(""" & CFG_COMPANY & """,tblConfig[Setting],0)),"""")" & _
                   "&""   |   Version " & SYS_VERSION & """"
        .Font.Italic = True
        .HorizontalAlignment = xlCenter
    End With

    '--- Selected part panel ---
    PanelHeader ws, "B6:C6", "SELECTED PART"
    LabelValue ws, "B7", "Part Number", CP_PART
    LabelValue ws, "B8", "Revision", CP_REV
    LabelValue ws, "B9", "Customer", CP_CUSTOMER
    LabelValue ws, "B10", "Route", CP_ROUTE
    LabelValue ws, "B11", "Approval", CP_APPROVAL
    LabelValue ws, "B12", "Current Status", CP_STATUSTEXT
    LabelValue ws, "B13", "State", CP_STATE

    ws.Range(CP_PART).Font.Bold = True
    ws.Range(CP_PART).Font.Size = 12
    ws.Range(CP_PART).Interior.Color = RGB(255, 251, 224)
    ws.Range(CP_REV).Interior.Color = RGB(255, 251, 224)

    '--- Stage status panel ---
    PanelHeader ws, "B15:C15", "STAGE STATUS"
    LabelValue ws, "B16", COL_FOLDERSTATUS, CP_FOLDER
    LabelValue ws, "B17", COL_EXCELSTATUS, CP_EXCEL
    LabelValue ws, "B18", COL_DWGSTATUS, CP_DWG
    LabelValue ws, "B19", COL_PDFSTATUS, CP_PDF
    LabelValue ws, "B20", COL_MAILSTATUS, CP_MAIL
    LabelValue ws, "B21", COL_AUTOSTATUS, CP_AUTO

    '--- Approval flags panel ---
    PanelHeader ws, "B23:C23", "APPROVAL FLAGS  (edit these in MASTER_LIST)"
    LabelValue ws, "B24", COL_ROUTEOK, CP_ROUTEOK
    LabelValue ws, "B25", COL_PDFOK, CP_PDFOK
    LabelValue ws, "B26", COL_MAILOK, CP_MAILOK
    LabelValue ws, "B27", COL_MAILREQUIRED, CP_MAILREQ

    '--- Files panel ---
    PanelHeader ws, "B29:C29", "FILES  (green = present on disk)"
    LabelValue ws, "B30", "Project Folder", CP_PROJPATH
    LabelValue ws, "B31", "Process Excel", CP_XLPATH
    LabelValue ws, "B32", "Drawing", CP_DWGPATH
    LabelValue ws, "B33", "PDF", CP_PDFPATH

    '--- Progress panel ---
    PanelHeader ws, "B35:C35", "AUTOMATION PROGRESS"
    With ws.Range("B36:C58")
        .Merge
        .HorizontalAlignment = xlLeft
        .VerticalAlignment = xlTop
        .WrapText = True
        .Font.Name = "Consolas"
        .Font.Size = 10
        .Interior.Color = C_LIGHT
        .Borders.LineStyle = xlContinuous
        .Borders.Color = C_BORDER
    End With

    '--- Search panel ---
    PanelHeader ws, "E6:H6", "SEARCH"
    ws.Range("E7").Value = "Search in"
    ws.Range("E8").Value = "Text"
    StyleLabel ws.Range("E7:E8")
    With ws.Range(CP_SEARCHFIELD)
        .Value = COL_PARTNO
        .Interior.Color = RGB(255, 251, 224)
        .Borders.LineStyle = xlContinuous
        .Borders.Color = C_BORDER
    End With
    With ws.Range("F8:H8")
        .Merge
        .Interior.Color = RGB(255, 251, 224)
        .Borders.LineStyle = xlContinuous
        .Borders.Color = C_BORDER
    End With
    AddListValidation ws.Range(CP_SEARCHFIELD), _
                      COL_PARTNO & "," & COL_CUSTOMER & "," & COL_REVISION & "," & COL_ROUTE & ",All"

    ws.Range("E10").Value = COL_PARTNO
    ws.Range("F10").Value = COL_REVISION
    ws.Range("G10").Value = COL_CUSTOMER
    ws.Range("H10").Value = COL_ROUTE
    With ws.Range("E10:H10")
        .Font.Bold = True
        .Font.Color = vbWhite
        .Interior.Color = C_MIDBLUE
        .HorizontalAlignment = xlLeft
    End With
    With ws.Range(ws.Cells(CP_RESULTTOP, 5), ws.Cells(CP_RESULTLAST, 8))
        .Borders.LineStyle = xlContinuous
        .Borders.Color = C_BORDER
        .Interior.Color = vbWhite
    End With

    '--- KPI cards ---
    PanelHeader ws, "E27:H27", "DASHBOARD KPI"
    Dim labels As Variant
    labels = KpiLabels()
    For i = 0 To 11
        BuildKpiCard ws, KpiLabelCell(i), KpiValueCell(i), CStr(labels(i))
    Next i

    '--- Named ranges ---
    NameRange ws, CP_PART, NR_SELPART
    NameRange ws, CP_REV, NR_SELREV
    NameRange ws, CP_SEARCHFIELD, NR_SEARCHFIELD
    NameRange ws, CP_SEARCHTEXT, NR_SEARCH
    NameRange ws, CP_PROGRESS, NR_PROGRESS

    ' The Part Number cell offers every part already in MASTER_LIST.
    On Error Resume Next
    With ws.Range(CP_PART).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertWarning, _
             Formula1:="=INDIRECT(""" & TBL_MASTER & "[" & COL_PARTNO & "]"")"
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = False
    End With
    Err.Clear
    On Error GoTo 0

    BuildControlPanelButtons ws

    HideGridlines ws
End Sub

'--- The control panel reads as a dashboard, not a spreadsheet ----------------
Private Sub HideGridlines(ByVal ws As Worksheet)
    Dim prevUpdating As Boolean
    On Error Resume Next
    prevUpdating = Application.ScreenUpdating
    Application.ScreenUpdating = True
    ws.Activate
    ActiveWindow.DisplayGridlines = False
    ws.Range("B6").Select
    Application.ScreenUpdating = prevUpdating
    Err.Clear
    On Error GoTo 0
End Sub

Private Sub PanelHeader(ByVal ws As Worksheet, ByVal addr As String, ByVal titleText As String)
    With ws.Range(addr)
        .Merge
        .Value = titleText
        .Font.Bold = True
        .Font.Color = vbWhite
        .Interior.Color = C_DARKBLUE
        .HorizontalAlignment = xlLeft
        .IndentLevel = 1
    End With
End Sub

Private Sub LabelValue(ByVal ws As Worksheet, ByVal labelAddr As String, ByVal labelText As String, _
                       ByVal valueAddr As String)
    ws.Range(labelAddr).Value = labelText
    StyleLabel ws.Range(labelAddr)
    With ws.Range(valueAddr)
        .Borders.LineStyle = xlContinuous
        .Borders.Color = C_BORDER
        .HorizontalAlignment = xlLeft
        .IndentLevel = 1
    End With
End Sub

Private Sub StyleLabel(ByVal rng As Range)
    With rng
        .Font.Bold = True
        .Interior.Color = C_LIGHT
        .Borders.LineStyle = xlContinuous
        .Borders.Color = C_BORDER
        .HorizontalAlignment = xlLeft
        .IndentLevel = 1
    End With
End Sub

Private Sub BuildKpiCard(ByVal ws As Worksheet, ByVal labelAddr As String, _
                         ByVal valueAddr As String, ByVal labelText As String)
    With ws.Range(labelAddr)
        .Value = labelText
        .Font.Size = 8
        .Font.Bold = True
        .Font.Color = RGB(90, 90, 90)
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlBottom
        .WrapText = True
        .Interior.Color = C_LIGHT
        .Borders(xlEdgeLeft).LineStyle = xlContinuous
        .Borders(xlEdgeRight).LineStyle = xlContinuous
        .Borders(xlEdgeTop).LineStyle = xlContinuous
        .Borders.Color = C_BORDER
    End With
    With ws.Range(valueAddr)
        .Value = 0
        .Font.Size = 18
        .Font.Bold = True
        .Font.Color = C_DARKBLUE
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
        .Interior.Color = vbWhite
        .Borders(xlEdgeLeft).LineStyle = xlContinuous
        .Borders(xlEdgeRight).LineStyle = xlContinuous
        .Borders(xlEdgeBottom).LineStyle = xlContinuous
        .Borders.Color = C_BORDER
    End With
    ws.Range(labelAddr).RowHeight = 26
    ws.Range(valueAddr).RowHeight = 26
End Sub

Private Sub NameRange(ByVal ws As Worksheet, ByVal addr As String, ByVal nameText As String)
    On Error Resume Next
    ThisWorkbook.Names(nameText).Delete
    ThisWorkbook.Names.Add Name:=nameText, RefersTo:="='" & ws.Name & "'!" & _
                           ws.Range(addr).Address(True, True)
    Err.Clear
    On Error GoTo 0
End Sub

'==============================================================================
' Topic 55 - the buttons
'==============================================================================
Private Sub BuildControlPanelButtons(ByVal ws As Worksheet)
    Dim captions As Variant, macros As Variant
    Dim i As Long, colIdx As Long, rowIdx As Long
    Dim leftPos As Double, topPos As Double
    Dim perColumn As Long

    captions = Array( _
        "NEW PART", "VALIDATE ROUTE", "RUN AUTOMATION", "CREATE FOLDERS", _
        "CREATE PROCESS EXCEL", "CREATE AUTOCAD DWG", "OPEN DWG", "MARK DWG AS EDITED", _
        "CONVERT TO PDF", "SEND PDF", "MARK MAIL AS SENT", _
        "MAIL NOT SENT", "REBUILD MAIL FIELDS", "OPEN PROJECT FOLDER", "OPEN EXCEL", _
        "OPEN PDF", "SEARCH", "SELECT PART", "REFRESH DASHBOARD", _
        "REGENERATE DWG", "REGENERATE PDF", "RESET / REPROCESS")

    macros = Array( _
        "btnNewPart", "btnValidateRoute", "btnRunAutomation", "btnCreateFolders", _
        "btnCreateProcessExcel", "btnCreateAutoCADDWG", "btnOpenDWG", "btnMarkDWGAsEdited", _
        "btnConvertToPDF", "btnSendPDF", "btnMarkMailAsSent", _
        "btnMailCancelled", "btnRefreshMailFields", "btnOpenProjectFolder", "btnOpenExcel", _
        "btnOpenPDF", "btnSearch", "btnSelectPartFromList", "btnRefreshDashboard", _
        "RegenerateDWG", "RegeneratePDF", "btnResetReprocess")

    perColumn = 11

    For i = LBound(captions) To UBound(captions)
        colIdx = i \ perColumn
        rowIdx = i Mod perColumn
        If colIdx = 0 Then
            leftPos = ws.Range("J6").Left
        Else
            leftPos = ws.Range("L6").Left
        End If
        topPos = ws.Range("J6").Top + rowIdx * 32

        AddButton ws, CStr(captions(i)), CStr(macros(i)), leftPos, topPos, 180, 27, _
                  ButtonColour(CStr(captions(i)))
    Next i

    ' A short legend under the buttons.
    With ws.Range("J26:L27")
        .Merge
        .Value = "Buttons act on the SELECTED PART shown on the left." & vbCrLf & _
                 "Route OK / PDF OK / Mail OK are approvals - set them in MASTER_LIST."
        .Font.Italic = True
        .Font.Size = 9
        .WrapText = True
        .VerticalAlignment = xlTop
    End With
End Sub

Private Function ButtonColour(ByVal caption As String) As Long
    Select Case caption
        Case "RUN AUTOMATION":      ButtonColour = C_GREEN
        Case "SEND PDF":            ButtonColour = RGB(0, 112, 160)
        Case "RESET / REPROCESS", "REGENERATE DWG", "REGENERATE PDF"
                                    ButtonColour = RGB(176, 84, 24)
        Case Else:                  ButtonColour = C_DARKBLUE
    End Select
End Function

Private Sub AddButton(ByVal ws As Worksheet, ByVal caption As String, ByVal macroName As String, _
                      ByVal leftPos As Double, ByVal topPos As Double, _
                      ByVal widthPt As Double, ByVal heightPt As Double, ByVal fillColour As Long)
    Dim shp As Shape

    Set shp = ws.Shapes.AddShape(msoShapeRoundedRectangle, leftPos, topPos, widthPt, heightPt)
    With shp
        .Name = "btn_" & Replace$(Replace$(Replace$(caption, " ", "_"), "/", "_"), "-", "_")
        .Fill.Solid
        .Fill.ForeColor.RGB = fillColour
        .Line.ForeColor.RGB = fillColour
        .Line.Weight = 1
        .Adjustments(1) = 0.12
        With .TextFrame2
            .TextRange.Text = caption
            .TextRange.Font.Size = 10
            .TextRange.Font.Bold = msoTrue
            .TextRange.Font.Name = "Calibri"
            .TextRange.Font.Fill.ForeColor.RGB = vbWhite
            .VerticalAnchor = msoAnchorMiddle
            .HorizontalAnchor = msoAnchorCenter
            .TextRange.ParagraphFormat.Alignment = msoAlignCenter
            .MarginLeft = 2
            .MarginRight = 2
        End With
        .OnAction = "'" & ThisWorkbook.Name & "'!" & macroName
    End With
End Sub

'==============================================================================
' README (topic 109)
'==============================================================================
Private Sub BuildReadmeSheet()
    Dim ws As Worksheet
    Dim lines As Variant, i As Long, rowNo As Long
    Dim txt As String

    Set ws = EnsureSheet(SH_README, True)
    SheetTitle ws, "README", "Purpose, setup, daily workflow, status meanings and troubleshooting."

    lines = ReadmeLines()
    rowNo = 4
    For i = LBound(lines) To UBound(lines)
        txt = CStr(lines(i))
        ws.Cells(rowNo, 1).Value = txt
        If Len(txt) > 0 Then
            If txt = UCase$(txt) And Left$(txt, 2) <> "  " And InStr(txt, ".") = 0 Then
                ws.Cells(rowNo, 1).Font.Bold = True
                ws.Cells(rowNo, 1).Font.Color = C_DARKBLUE
                ws.Cells(rowNo, 1).Font.Size = 12
            End If
        End If
        rowNo = rowNo + 1
    Next i

    ws.Columns("A").ColumnWidth = 120
    ws.Range("A1").Select
End Sub

Private Function ReadmeLines() As Variant
    ReadmeLines = Array( _
    "SYSTEM PURPOSE", _
    "  " & SYS_NAME & " automates the complete release cycle of a 3P process package:", _
    "  folder structure, process Excel, AutoCAD drawing, PDF release and Outlook distribution to the process owners.", _
    "  MASTER_LIST is the single source of truth for the status of every part.", _
    "", _
    "REQUIRED SOFTWARE", _
    "  Microsoft Excel (desktop, macro enabled), AutoCAD 2026 (or the release named in CONFIG), Microsoft Outlook (desktop).", _
    "  Windows only - the automation uses COM.", _
    "", _
    "SETUP", _
    "  1. Save this workbook as 3P_2.0_AUTOMATION.xlsm (macro enabled).", _
    "  2. CONFIG: set Project Root Folder, Default DWG Template, PDF Plot Configuration, Company Name, Department Name.", _
    "  3. PROCESS_CONFIG: one row per process code - block name, Excel sheet name, X/Y position, scale, rotation.", _
    "  4. PROCESS_OWNER_CONFIG: replace the example addresses with the real Outlook addresses of the process owners.", _
    "  5. USER_CONFIG: your name, employee ID, department, default project folder.", _
    "  6. Make sure the AutoCAD template contains the blocks named in PROCESS_CONFIG (BLK_CT, BLK_FC, ...).", _
    "", _
    "DAILY WORKFLOW", _
    "  1. NEW PART - enter Part Number, Revision, Customer, Route, Project Folder, DWG Template.", _
    "  2. VALIDATE ROUTE - confirms every process code exists in PROCESS_CONFIG.", _
    "  3. Set Route OK = YES in MASTER_LIST.", _
    "  4. RUN AUTOMATION - creates the folders, the process Excel and the AutoCAD drawing.", _
    "  5. The engineer edits the drawing if required, then presses MARK DWG AS EDITED.", _
    "  6. Set PDF OK = YES, press RUN AUTOMATION (or CONVERT TO PDF) - the PDF is plotted and verified.", _
    "  7. Set Mail OK = YES, press SEND PDF - Outlook opens with the process owners, subject, body and the PDF attached.", _
    "  8. Send the message in Outlook, then press MARK MAIL AS SENT.", _
    "  9. Automation Status becomes Complete.", _
    "", _
    "BUTTONS", _
    "  NEW PART              Adds a row to MASTER_LIST and selects it.", _
    "  VALIDATE ROUTE        Checks part fields and every process code in the route.", _
    "  RUN AUTOMATION        Restart-safe: continues from the first incomplete stage.", _
    "  CREATE FOLDERS        Project Folder \ Part Number \ DWG, Excel, PDF.", _
    "  CREATE PROCESS EXCEL  <Part Number>.xlsx with one sheet per route step.", _
    "  CREATE AUTOCAD DWG    Opens the template, inserts the route blocks, saves <Part Number>.dwg.", _
    "  OPEN DWG              Opens the drawing in AutoCAD.", _
    "  MARK DWG AS EDITED    Records that the engineer edited the drawing.", _
    "  CONVERT TO PDF        Plots the latest saved drawing to <Part Number>.pdf.", _
    "  SEND PDF              Builds the Outlook message and attaches the PDF automatically.", _
    "  MARK MAIL AS SENT     Verifies the message in Outlook Sent Items and sets Mail Status = Sent.", _
    "  MAIL NOT SENT         Records that the draft was closed before sending.", _
    "  REBUILD MAIL FIELDS   Rebuilds Mail To / CC / Subject from the route without opening Outlook.", _
    "  OPEN PROJECT FOLDER / OPEN EXCEL / OPEN PDF   Open the part's documents.", _
    "  SEARCH / SELECT PART  Find a part by number, customer, revision or route and make it active.", _
    "  REGENERATE DWG / PDF  Deliberate regeneration - the current file is backed up first.", _
    "  RESET / REPROCESS     Resets statuses only. No production file is ever deleted.", _
    "", _
    "STATUS MEANINGS", _
    "  Folder Status      Not Started / Created / Error", _
    "  Excel Status       Not Started / Created / Error", _
    "  DWG Status         Not Started / Created / Edited / Error", _
    "  PDF Status         Not Started / Waiting / Created / Error", _
    "  Mail Status        Not Started / Waiting / Ready / Sent / Skipped / Error", _
    "  Automation Status  Not Started / Waiting / Running / Complete / Error", _
    "  Ready means the Outlook message exists but has NOT been sent. Only a verified send sets Sent.", _
    "", _
    "AUTOCAD REQUIREMENTS", _
    "  The template named in DWG Template must exist and must contain every block named in PROCESS_CONFIG.", _
    "  A missing block stops the drawing stage with 'Process block BLK_xx not found in AutoCAD template.'", _
    "  Block positions, scale and rotation come from PROCESS_CONFIG - never from the VBA code.", _
    "", _
    "OUTLOOK REQUIREMENTS", _
    "  Outlook desktop must be installed and signed in. Email Send Mode is DISPLAY by default:", _
    "  the message is prepared and shown, and you send it yourself. SEND mode sends automatically.", _
    "  Recipients always come from PROCESS_OWNER_CONFIG via the route - no address is hard-coded.", _
    "", _
    "TROUBLESHOOTING", _
    "  'AutoCAD template not found'        Check DWG Template in MASTER_LIST or Default DWG Template in CONFIG.", _
    "  'Process block ... not found'       Add the block to the template, or correct Block Name in PROCESS_CONFIG.", _
    "  'AutoCAD is not available'          Start AutoCAD once manually; check AutoCAD Application in CONFIG.", _
    "  'PDF creation failed'               Check PDF Plot Configuration in CONFIG (default 'DWG To PDF.pc3').", _
    "  'PDF file not found'                Create the PDF before sending; check the PDF folder.", _
    "  'Outlook is not available'          Start Outlook and sign in, then press SEND PDF again.", _
    "  'No process owner e-mail addresses' Fill in Email and set Enabled = YES in PROCESS_OWNER_CONFIG.", _
    "  Every failure is also written to AUTOMATION_LOG with the exact message.", _
    "", _
    "BACKUP AND REPROCESSING", _
    "  RESET / REPROCESS only clears statuses - files stay on disk and are reused.", _
    "  REGENERATE DWG / REGENERATE PDF copy the current file into <Part Number>\Backup with a timestamp first.", _
    "  Nothing in the project folder is ever deleted automatically.")
End Function

'==============================================================================
' Topic 110 - sample part
'==============================================================================
Public Sub AddSampleData()
    Dim r As ListRow
    If PartExists("PN-10025", "A") Then Exit Sub
    Set r = AddPartRow("PN-10025", "A", "TEST CUSTOMER", "CT-FC-CH-ET-WD", _
                       GetConfigValue(CFG_PROJECTROOT, "D:\3P Projects"), _
                       GetConfigValue(CFG_DWGTEMPLATE, "D:\3P Templates\3P_Template.dwg"), _
                       YES_, NO_, NO_, YES_)
    MLSet r, COL_OTHERDETAILS, "Sample part created by the workbook builder."
    SetSelectedPart "PN-10025", "A"
    LogRowAction r, ACT_NEWPART, vbNullString, ST_NOTSTARTED, RES_OK, "Sample data"
End Sub

'==============================================================================
' Setup checker - reports what still needs configuring (topic 116)
'==============================================================================
Public Sub CheckSetup()
    Dim problems As Collection, notes As String
    Dim root As String, tpl As String
    Dim lo As ListObject, r As ListRow
    Dim badEmails As Long

    Set problems = New Collection

    root = GetConfigValue(CFG_PROJECTROOT, vbNullString)
    If Len(root) = 0 Then
        problems.Add "CONFIG: " & CFG_PROJECTROOT & " is empty."
    ElseIf Not FolderExists(root) Then
        problems.Add "CONFIG: the project root '" & root & "' does not exist on this computer."
    End If

    tpl = GetConfigValue(CFG_DWGTEMPLATE, vbNullString)
    If Len(tpl) = 0 Then
        problems.Add "CONFIG: " & CFG_DWGTEMPLATE & " is empty."
    ElseIf Not FileExists(tpl) Then
        problems.Add "CONFIG: the DWG template '" & tpl & "' was not found."
    End If

    If EmailSendMode() = "SEND" Then
        problems.Add "CONFIG: " & CFG_MAILMODE & " is SEND - e-mails will go out without review."
    End If

    Set lo = RequireTable(SH_OWNER, TBL_OWNER)
    For Each r In lo.ListRows
        If IsYes(GetCell(lo, r, OW_ENABLED)) Then
            If Not IsValidEmail(NzTrim(GetCell(lo, r, OW_EMAIL))) Then badEmails = badEmails + 1
            If InStr(1, NzTrim(GetCell(lo, r, OW_EMAIL)), "@company.com", vbTextCompare) > 0 Then
                notes = notes & "  " & NzTrim(GetCell(lo, r, OW_CODE)) & _
                        " still uses the example address " & NzTrim(GetCell(lo, r, OW_EMAIL)) & vbCrLf
            End If
        End If
    Next r
    If badEmails > 0 Then problems.Add "PROCESS_OWNER_CONFIG: " & badEmails & " enabled row(s) have an invalid e-mail address."

    If Not OutlookIsRunning() Then problems.Add "Outlook is not running (it will be started when needed)."

    If problems.Count = 0 Then
        InfoBox "Setup check passed." & vbCrLf & vbCrLf & _
                IIf(Len(notes) > 0, "Reminders:" & vbCrLf & notes, vbNullString)
    Else
        WarnBox "Setup check found " & problems.Count & " item(s):" & vbCrLf & vbCrLf & _
                JoinCollection(problems, vbCrLf) & _
                IIf(Len(notes) > 0, vbCrLf & vbCrLf & "Reminders:" & vbCrLf & notes, vbNullString)
    End If
End Sub

'--- Report which configured blocks exist in the template (topic 21) ----------
Public Sub CheckTemplateBlocks()
    Dim tpl As String, report As String
    tpl = GetConfigValue(CFG_DWGTEMPLATE, vbNullString)
    If Len(tpl) = 0 Then
        WarnBox "No default template is configured in CONFIG."
        Exit Sub
    End If
    SetStatusBar "Inspecting " & tpl & " ..."
    report = BlockAvailabilityReport(tpl)
    SetStatusBar vbNullString
    InfoBox "Template: " & tpl & vbCrLf & vbCrLf & report
End Sub
