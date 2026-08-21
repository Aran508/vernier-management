Attribute VB_Name = "modFormBuilder"
'==============================================================================
' Module      : modFormBuilder
' Purpose     : Topic 57 - build frmAutomation programmatically, controls and
'               code included, so no manual form drawing is required.
'
' REQUIREMENT : File > Options > Trust Center > Trust Center Settings >
'               Macro Settings > "Trust access to the VBA project object model"
'               must be ticked. If it is not, run BUILD_AUTOMATION_FORM anyway -
'               it reports exactly what to do, and docs/USERFORM.md lists the
'               manual steps with the identical control names.
'
' The rest of the system never references frmAutomation at compile time
' (modMain uses VBA.UserForms.Add), so the project compiles and runs whether or
' not the form exists.
'==============================================================================
Option Explicit

Private Const VB_FORM As Long = 3          ' vbext_ct_MSForm

'==============================================================================
' MAIN ENTRY POINT
'==============================================================================
Public Sub BUILD_AUTOMATION_FORM()
    Dim vbProj As Object, vbComp As Object, dsg As Object, ctl As Object

    On Error GoTo NoAccess

    Set vbProj = ThisWorkbook.VBProject          ' fails when access is not trusted

    RemoveExistingForm vbProj

    Set vbComp = vbProj.VBComponents.Add(VB_FORM)
    vbComp.Name = "frmAutomation"

    With vbComp
        .Properties("Caption") = SYS_SHORT & " - Part Entry / Run Automation"
        .Properties("Width") = 510
        .Properties("Height") = 380
    End With

    Set dsg = vbComp.Designer

    Set ctl = dsg.Controls.Add("Forms.Label.1", "lblTitle", True)
    With ctl
        .Left = 12: .Top = 8: .Width = 480: .Height = 20
        .Caption = "3P 2.0  -  PART ENTRY / RUN AUTOMATION"
        .Font.Size = 12
        .Font.Bold = True
    End With
    Set ctl = dsg.Controls.Add("Forms.Label.1", "lblPartNumber", True)
    With ctl
        .Left = 12: .Top = 38: .Width = 120: .Height = 16
        .Caption = "Part Number"
    End With
    Set ctl = dsg.Controls.Add("Forms.TextBox.1", "txtPartNumber", True)
    With ctl
        .Left = 140: .Top = 36: .Width = 200: .Height = 18
    End With
    Set ctl = dsg.Controls.Add("Forms.Label.1", "lblRevision", True)
    With ctl
        .Left = 12: .Top = 62: .Width = 120: .Height = 16
        .Caption = "Revision"
    End With
    Set ctl = dsg.Controls.Add("Forms.TextBox.1", "txtRevision", True)
    With ctl
        .Left = 140: .Top = 60: .Width = 60: .Height = 18
    End With
    Set ctl = dsg.Controls.Add("Forms.Label.1", "lblCustomer", True)
    With ctl
        .Left = 12: .Top = 86: .Width = 120: .Height = 16
        .Caption = "Customer"
    End With
    Set ctl = dsg.Controls.Add("Forms.TextBox.1", "txtCustomer", True)
    With ctl
        .Left = 140: .Top = 84: .Width = 240: .Height = 18
    End With
    Set ctl = dsg.Controls.Add("Forms.Label.1", "lblRoute", True)
    With ctl
        .Left = 12: .Top = 110: .Width = 120: .Height = 16
        .Caption = "Route"
    End With
    Set ctl = dsg.Controls.Add("Forms.TextBox.1", "txtRoute", True)
    With ctl
        .Left = 140: .Top = 108: .Width = 240: .Height = 18
    End With
    Set ctl = dsg.Controls.Add("Forms.Label.1", "lblValidCodes", True)
    With ctl
        .Left = 140: .Top = 128: .Width = 350: .Height = 14
        .Caption = "Valid process codes:"
        .Font.Size = 8
    End With
    Set ctl = dsg.Controls.Add("Forms.Label.1", "lblProjectFolder", True)
    With ctl
        .Left = 12: .Top = 150: .Width = 120: .Height = 16
        .Caption = "Project Folder"
    End With
    Set ctl = dsg.Controls.Add("Forms.TextBox.1", "txtProjectFolder", True)
    With ctl
        .Left = 140: .Top = 148: .Width = 280: .Height = 18
    End With
    Set ctl = dsg.Controls.Add("Forms.CommandButton.1", "cmdBrowseFolder", True)
    With ctl
        .Left = 426: .Top = 147: .Width = 60: .Height = 20
        .Caption = "..."
    End With
    Set ctl = dsg.Controls.Add("Forms.Label.1", "lblTemplate", True)
    With ctl
        .Left = 12: .Top = 176: .Width = 120: .Height = 16
        .Caption = "DWG Template"
    End With
    Set ctl = dsg.Controls.Add("Forms.TextBox.1", "txtTemplate", True)
    With ctl
        .Left = 140: .Top = 174: .Width = 280: .Height = 18
    End With
    Set ctl = dsg.Controls.Add("Forms.CommandButton.1", "cmdBrowseTemplate", True)
    With ctl
        .Left = 426: .Top = 173: .Width = 60: .Height = 20
        .Caption = "..."
    End With
    Set ctl = dsg.Controls.Add("Forms.Label.1", "lblRouteOK", True)
    With ctl
        .Left = 12: .Top = 204: .Width = 120: .Height = 16
        .Caption = "Route OK"
    End With
    Set ctl = dsg.Controls.Add("Forms.ComboBox.1", "cboRouteOK", True)
    With ctl
        .Left = 140: .Top = 202: .Width = 70: .Height = 18
    End With
    Set ctl = dsg.Controls.Add("Forms.Label.1", "lblPDFOK", True)
    With ctl
        .Left = 230: .Top = 204: .Width = 80: .Height = 16
        .Caption = "PDF OK"
    End With
    Set ctl = dsg.Controls.Add("Forms.ComboBox.1", "cboPDFOK", True)
    With ctl
        .Left = 320: .Top = 202: .Width = 70: .Height = 18
    End With
    Set ctl = dsg.Controls.Add("Forms.Label.1", "lblMailOK", True)
    With ctl
        .Left = 12: .Top = 230: .Width = 120: .Height = 16
        .Caption = "Mail OK"
    End With
    Set ctl = dsg.Controls.Add("Forms.ComboBox.1", "cboMailOK", True)
    With ctl
        .Left = 140: .Top = 228: .Width = 70: .Height = 18
    End With
    Set ctl = dsg.Controls.Add("Forms.Label.1", "lblMailRequired", True)
    With ctl
        .Left = 230: .Top = 230: .Width = 80: .Height = 16
        .Caption = "Mail Required"
    End With
    Set ctl = dsg.Controls.Add("Forms.ComboBox.1", "cboMailRequired", True)
    With ctl
        .Left = 320: .Top = 228: .Width = 70: .Height = 18
    End With
    Set ctl = dsg.Controls.Add("Forms.Label.1", "lblStatus", True)
    With ctl
        .Left = 12: .Top = 262: .Width = 480: .Height = 34
        .Caption = ""
    End With
    Set ctl = dsg.Controls.Add("Forms.CommandButton.1", "cmdValidate", True)
    With ctl
        .Left = 12: .Top = 304: .Width = 120: .Height = 28
        .Caption = "VALIDATE"
        .Font.Bold = True
    End With
    Set ctl = dsg.Controls.Add("Forms.CommandButton.1", "cmdRun", True)
    With ctl
        .Left = 140: .Top = 304: .Width = 160: .Height = 28
        .Caption = "RUN AUTOMATION"
        .Font.Bold = True
    End With
    Set ctl = dsg.Controls.Add("Forms.CommandButton.1", "cmdCancel", True)
    With ctl
        .Left = 308: .Top = 304: .Width = 100: .Height = 28
        .Caption = "CANCEL"
    End With

    vbComp.CodeModule.AddFromString FormCode()

    InfoBox "frmAutomation has been created." & vbCrLf & vbCrLf & _
            "Press NEW PART on the CONTROL_PANEL to use it."
    Exit Sub

NoAccess:
    ErrorBox "The UserForm could not be created automatically." & vbCrLf & vbCrLf & _
             Err.Description & vbCrLf & vbCrLf & _
             "Tick File > Options > Trust Center > Trust Center Settings >" & vbCrLf & _
             "Macro Settings > 'Trust access to the VBA project object model'," & vbCrLf & _
             "then run BUILD_AUTOMATION_FORM again." & vbCrLf & vbCrLf & _
             "Alternatively follow docs/USERFORM.md to draw the form by hand -" & vbCrLf & _
             "the system works exactly the same either way (NEW PART falls back" & vbCrLf & _
             "to guided prompts when the form is absent)."
End Sub

Private Sub RemoveExistingForm(ByVal vbProj As Object)
    Dim c As Object
    On Error Resume Next
    For Each c In vbProj.VBComponents
        If c.Name = "frmAutomation" Then
            vbProj.VBComponents.Remove c
            Exit For
        End If
    Next c
    Err.Clear
    On Error GoTo 0
End Sub

Private Function FormCode() As String
    Dim s As String
    s = s & "Option Explicit" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "'==============================================================================" & vbCrLf
    s = s & "' frmAutomation - part entry and automation launcher (topic 57)" & vbCrLf
    s = s & "'==============================================================================" & vbCrLf
    s = s & "Private Sub UserForm_Initialize()" & vbCrLf
    s = s & "    Dim r As ListRow" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    Me.Caption = ""3P 2.0 - Part Entry / Run Automation""" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    FillYesNo cboRouteOK" & vbCrLf
    s = s & "    FillYesNo cboPDFOK" & vbCrLf
    s = s & "    FillYesNo cboMailOK" & vbCrLf
    s = s & "    FillYesNo cboMailRequired" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    lblValidCodes.Caption = ""Valid process codes: "" & ValidProcessCodeList("", "")" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    txtProjectFolder.Text = GetUserValue(USR_PROJFOLDER, GetConfigValue(CFG_PROJECTROOT, """"))" & vbCrLf
    s = s & "    txtTemplate.Text = GetConfigValue(CFG_DWGTEMPLATE, """")" & vbCrLf
    s = s & "    cboRouteOK.Value = NO_" & vbCrLf
    s = s & "    cboPDFOK.Value = NO_" & vbCrLf
    s = s & "    cboMailOK.Value = NO_" & vbCrLf
    s = s & "    cboMailRequired.Value = GetConfigValue(CFG_MAILREQDEF, YES_)" & vbCrLf
    s = s & "    txtRevision.Text = ""A""" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    Set r = GetSelectedRow(False)" & vbCrLf
    s = s & "    If Not r Is Nothing Then LoadRow r" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    lblStatus.Caption = ""Enter the part details, then VALIDATE.""" & vbCrLf
    s = s & "End Sub" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "Private Sub FillYesNo(ByVal cbo As MSForms.ComboBox)" & vbCrLf
    s = s & "    cbo.Clear" & vbCrLf
    s = s & "    cbo.AddItem YES_" & vbCrLf
    s = s & "    cbo.AddItem NO_" & vbCrLf
    s = s & "End Sub" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "Private Sub LoadRow(ByVal r As ListRow)" & vbCrLf
    s = s & "    txtPartNumber.Text = MLGetStr(r, COL_PARTNO)" & vbCrLf
    s = s & "    txtRevision.Text = MLGetStr(r, COL_REVISION)" & vbCrLf
    s = s & "    txtCustomer.Text = MLGetStr(r, COL_CUSTOMER)" & vbCrLf
    s = s & "    txtRoute.Text = MLGetStr(r, COL_ROUTE)" & vbCrLf
    s = s & "    txtProjectFolder.Text = MLGetStr(r, COL_PROJFOLDER)" & vbCrLf
    s = s & "    txtTemplate.Text = TemplateFor(r)" & vbCrLf
    s = s & "    cboRouteOK.Value = UCase$(MLGetStr(r, COL_ROUTEOK))" & vbCrLf
    s = s & "    cboPDFOK.Value = UCase$(MLGetStr(r, COL_PDFOK))" & vbCrLf
    s = s & "    cboMailOK.Value = UCase$(MLGetStr(r, COL_MAILOK))" & vbCrLf
    s = s & "    cboMailRequired.Value = UCase$(MLGetStr(r, COL_MAILREQUIRED))" & vbCrLf
    s = s & "    lblStatus.Caption = ""Loaded from MASTER_LIST: "" & CurrentStatusText(r)" & vbCrLf
    s = s & "End Sub" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "'--- Create the row if it is new, otherwise update the existing one -----------" & vbCrLf
    s = s & "Private Function CommitRow() As ListRow" & vbCrLf
    s = s & "    Dim r As ListRow" & vbCrLf
    s = s & "    Dim pn As String, rev As String" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    pn = Trim$(txtPartNumber.Text)" & vbCrLf
    s = s & "    rev = Trim$(txtRevision.Text)" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    If Len(pn) = 0 Then" & vbCrLf
    s = s & "        lblStatus.Caption = ""Part Number is required.""" & vbCrLf
    s = s & "        Exit Function" & vbCrLf
    s = s & "    End If" & vbCrLf
    s = s & "    If Len(rev) = 0 Then" & vbCrLf
    s = s & "        lblStatus.Caption = ""Revision is required.""" & vbCrLf
    s = s & "        Exit Function" & vbCrLf
    s = s & "    End If" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    On Error Resume Next" & vbCrLf
    s = s & "    Set r = FindPartRow(pn, rev)" & vbCrLf
    s = s & "    On Error GoTo 0" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    If r Is Nothing Then" & vbCrLf
    s = s & "        Set r = AddPartRow(pn, rev, Trim$(txtCustomer.Text), Trim$(txtRoute.Text), _" & vbCrLf
    s = s & "                           Trim$(txtProjectFolder.Text), Trim$(txtTemplate.Text), _" & vbCrLf
    s = s & "                           NzUpper(cboRouteOK.Value), NzUpper(cboPDFOK.Value), _" & vbCrLf
    s = s & "                           NzUpper(cboMailOK.Value), NzUpper(cboMailRequired.Value))" & vbCrLf
    s = s & "        LogRowAction r, ACT_NEWPART, """", ST_NOTSTARTED, RES_OK, ""Created from frmAutomation""" & vbCrLf
    s = s & "    Else" & vbCrLf
    s = s & "        MLSet r, COL_CUSTOMER, Trim$(txtCustomer.Text)" & vbCrLf
    s = s & "        MLSet r, COL_ROUTE, UCase$(Trim$(txtRoute.Text))" & vbCrLf
    s = s & "        MLSet r, COL_PROJFOLDER, Trim$(txtProjectFolder.Text)" & vbCrLf
    s = s & "        MLSet r, COL_DWGTEMPLATE, Trim$(txtTemplate.Text)" & vbCrLf
    s = s & "        MLSet r, COL_ROUTEOK, NzUpper(cboRouteOK.Value)" & vbCrLf
    s = s & "        MLSet r, COL_PDFOK, NzUpper(cboPDFOK.Value)" & vbCrLf
    s = s & "        MLSet r, COL_MAILOK, NzUpper(cboMailOK.Value)" & vbCrLf
    s = s & "        MLSet r, COL_MAILREQUIRED, NzUpper(cboMailRequired.Value)" & vbCrLf
    s = s & "        MLTouch r, ""Edited from frmAutomation""" & vbCrLf
    s = s & "    End If" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    SetSelectedPart pn, rev" & vbCrLf
    s = s & "    Set CommitRow = r" & vbCrLf
    s = s & "End Function" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "Private Sub cmdValidate_Click()" & vbCrLf
    s = s & "    Dim r As ListRow, msg As String" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    Set r = CommitRow()" & vbCrLf
    s = s & "    If r Is Nothing Then Exit Sub" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    If ValidateSelectedPart(r, msg) Then" & vbCrLf
    s = s & "        lblStatus.Caption = ""VALID - "" & RouteStepCount(MLGetStr(r, COL_ROUTE)) & _" & vbCrLf
    s = s & "                            "" process step(s). Ready to run.""" & vbCrLf
    s = s & "        LogRowAction r, ACT_VALIDATE, """", ""VALID"", RES_OK" & vbCrLf
    s = s & "    Else" & vbCrLf
    s = s & "        lblStatus.Caption = ""INVALID - see the message box.""" & vbCrLf
    s = s & "        ErrorBox msg" & vbCrLf
    s = s & "    End If" & vbCrLf
    s = s & "    modDashboard.RefreshDashboard" & vbCrLf
    s = s & "End Sub" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "Private Sub cmdRun_Click()" & vbCrLf
    s = s & "    Dim r As ListRow" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    Set r = CommitRow()" & vbCrLf
    s = s & "    If r Is Nothing Then Exit Sub" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "    Me.Hide" & vbCrLf
    s = s & "    modMain.RunAutomation" & vbCrLf
    s = s & "    Unload Me" & vbCrLf
    s = s & "End Sub" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "Private Sub cmdCancel_Click()" & vbCrLf
    s = s & "    Unload Me" & vbCrLf
    s = s & "End Sub" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "Private Sub cmdBrowseFolder_Click()" & vbCrLf
    s = s & "    Dim fd As Object" & vbCrLf
    s = s & "    On Error Resume Next" & vbCrLf
    s = s & "    Set fd = Application.FileDialog(4)          ' msoFileDialogFolderPicker" & vbCrLf
    s = s & "    If fd Is Nothing Then Exit Sub" & vbCrLf
    s = s & "    fd.Title = ""Select the project folder""" & vbCrLf
    s = s & "    If fd.Show = -1 Then txtProjectFolder.Text = fd.SelectedItems(1)" & vbCrLf
    s = s & "    On Error GoTo 0" & vbCrLf
    s = s & "End Sub" & vbCrLf
    s = s & "" & vbCrLf
    s = s & "Private Sub cmdBrowseTemplate_Click()" & vbCrLf
    s = s & "    Dim fd As Object" & vbCrLf
    s = s & "    On Error Resume Next" & vbCrLf
    s = s & "    Set fd = Application.FileDialog(3)          ' msoFileDialogFilePicker" & vbCrLf
    s = s & "    If fd Is Nothing Then Exit Sub" & vbCrLf
    s = s & "    fd.Title = ""Select the AutoCAD template""" & vbCrLf
    s = s & "    fd.Filters.Clear" & vbCrLf
    s = s & "    fd.Filters.Add ""AutoCAD drawing / template"", ""*.dwg; *.dwt""" & vbCrLf
    s = s & "    If fd.Show = -1 Then txtTemplate.Text = fd.SelectedItems(1)" & vbCrLf
    s = s & "    On Error GoTo 0" & vbCrLf
    s = s & "End Sub" & vbCrLf
    FormCode = s
End Function
