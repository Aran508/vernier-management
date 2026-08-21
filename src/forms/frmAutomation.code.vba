Option Explicit

'==============================================================================
' frmAutomation - part entry and automation launcher (topic 57)
'==============================================================================
Private Sub UserForm_Initialize()
    Dim r As ListRow

    Me.Caption = "3P 2.0 - Part Entry / Run Automation"

    FillYesNo cboRouteOK
    FillYesNo cboPDFOK
    FillYesNo cboMailOK
    FillYesNo cboMailRequired

    lblValidCodes.Caption = "Valid process codes: " & ValidProcessCodeList(", ")

    txtProjectFolder.Text = GetUserValue(USR_PROJFOLDER, GetConfigValue(CFG_PROJECTROOT, ""))
    txtTemplate.Text = GetConfigValue(CFG_DWGTEMPLATE, "")
    cboRouteOK.Value = NO_
    cboPDFOK.Value = NO_
    cboMailOK.Value = NO_
    cboMailRequired.Value = GetConfigValue(CFG_MAILREQDEF, YES_)
    txtRevision.Text = "A"

    Set r = GetSelectedRow(False)
    If Not r Is Nothing Then LoadRow r

    lblStatus.Caption = "Enter the part details, then VALIDATE."
End Sub

Private Sub FillYesNo(ByVal cbo As MSForms.ComboBox)
    cbo.Clear
    cbo.AddItem YES_
    cbo.AddItem NO_
End Sub

Private Sub LoadRow(ByVal r As ListRow)
    txtPartNumber.Text = MLGetStr(r, COL_PARTNO)
    txtRevision.Text = MLGetStr(r, COL_REVISION)
    txtCustomer.Text = MLGetStr(r, COL_CUSTOMER)
    txtRoute.Text = MLGetStr(r, COL_ROUTE)
    txtProjectFolder.Text = MLGetStr(r, COL_PROJFOLDER)
    txtTemplate.Text = TemplateFor(r)
    cboRouteOK.Value = UCase$(MLGetStr(r, COL_ROUTEOK))
    cboPDFOK.Value = UCase$(MLGetStr(r, COL_PDFOK))
    cboMailOK.Value = UCase$(MLGetStr(r, COL_MAILOK))
    cboMailRequired.Value = UCase$(MLGetStr(r, COL_MAILREQUIRED))
    lblStatus.Caption = "Loaded from MASTER_LIST: " & CurrentStatusText(r)
End Sub

'--- Create the row if it is new, otherwise update the existing one -----------
Private Function CommitRow() As ListRow
    Dim r As ListRow
    Dim pn As String, rev As String

    pn = Trim$(txtPartNumber.Text)
    rev = Trim$(txtRevision.Text)

    If Len(pn) = 0 Then
        lblStatus.Caption = "Part Number is required."
        Exit Function
    End If
    If Len(rev) = 0 Then
        lblStatus.Caption = "Revision is required."
        Exit Function
    End If

    On Error Resume Next
    Set r = FindPartRow(pn, rev)
    On Error GoTo 0

    If r Is Nothing Then
        Set r = AddPartRow(pn, rev, Trim$(txtCustomer.Text), Trim$(txtRoute.Text), _
                           Trim$(txtProjectFolder.Text), Trim$(txtTemplate.Text), _
                           NzUpper(cboRouteOK.Value), NzUpper(cboPDFOK.Value), _
                           NzUpper(cboMailOK.Value), NzUpper(cboMailRequired.Value))
        LogRowAction r, ACT_NEWPART, "", ST_NOTSTARTED, RES_OK, "Created from frmAutomation"
    Else
        MLSet r, COL_CUSTOMER, Trim$(txtCustomer.Text)
        MLSet r, COL_ROUTE, UCase$(Trim$(txtRoute.Text))
        MLSet r, COL_PROJFOLDER, Trim$(txtProjectFolder.Text)
        MLSet r, COL_DWGTEMPLATE, Trim$(txtTemplate.Text)
        MLSet r, COL_ROUTEOK, NzUpper(cboRouteOK.Value)
        MLSet r, COL_PDFOK, NzUpper(cboPDFOK.Value)
        MLSet r, COL_MAILOK, NzUpper(cboMailOK.Value)
        MLSet r, COL_MAILREQUIRED, NzUpper(cboMailRequired.Value)
        MLTouch r, "Edited from frmAutomation"
    End If

    SetSelectedPart pn, rev
    Set CommitRow = r
End Function

Private Sub cmdValidate_Click()
    Dim r As ListRow, msg As String

    Set r = CommitRow()
    If r Is Nothing Then Exit Sub

    If ValidateSelectedPart(r, msg) Then
        lblStatus.Caption = "VALID - " & RouteStepCount(MLGetStr(r, COL_ROUTE)) & _
                            " process step(s). Ready to run."
        LogRowAction r, ACT_VALIDATE, "", "VALID", RES_OK
    Else
        lblStatus.Caption = "INVALID - see the message box."
        ErrorBox msg
    End If
    modDashboard.RefreshDashboard
End Sub

Private Sub cmdRun_Click()
    Dim r As ListRow

    Set r = CommitRow()
    If r Is Nothing Then Exit Sub

    Me.Hide
    modMain.RunAutomation
    Unload Me
End Sub

Private Sub cmdCancel_Click()
    Unload Me
End Sub

Private Sub cmdBrowseFolder_Click()
    Dim fd As Object
    On Error Resume Next
    Set fd = Application.FileDialog(4)          ' msoFileDialogFolderPicker
    If fd Is Nothing Then Exit Sub
    fd.Title = "Select the project folder"
    If fd.Show = -1 Then txtProjectFolder.Text = fd.SelectedItems(1)
    On Error GoTo 0
End Sub

Private Sub cmdBrowseTemplate_Click()
    Dim fd As Object
    On Error Resume Next
    Set fd = Application.FileDialog(3)          ' msoFileDialogFilePicker
    If fd Is Nothing Then Exit Sub
    fd.Title = "Select the AutoCAD template"
    fd.Filters.Clear
    fd.Filters.Add "AutoCAD drawing / template", "*.dwg; *.dwt"
    If fd.Show = -1 Then txtTemplate.Text = fd.SelectedItems(1)
    On Error GoTo 0
End Sub
