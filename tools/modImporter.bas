Attribute VB_Name = "modImporter"
'==============================================================================
' Module      : modImporter  (setup helper - not part of the running system)
' Purpose     : Import every 3P 2.0 module from src\vba into the workbook that
'               is running this code, so the system can be assembled without
'               PowerShell.
'
' HOW TO USE
'   1. Open a new workbook and save it as 3P_2.0_AUTOMATION.xlsm.
'   2. Excel > File > Options > Trust Center > Trust Center Settings >
'      Macro Settings > tick "Trust access to the VBA project object model".
'   3. Alt+F11 > File > Import File... > tools\modImporter.bas
'   4. Run IMPORT_3P_MODULES and select the repository's src\vba folder.
'   5. Run modBuilder.BUILD_3P_WORKBOOK.
'   6. Run modFormBuilder.BUILD_AUTOMATION_FORM (optional).
'   7. Paste the three files from src\vba\document_modules into ThisWorkbook,
'      the CONTROL_PANEL sheet module and the MASTER_LIST sheet module.
'   8. Remove this helper module.
'==============================================================================
Option Explicit

Public Sub IMPORT_3P_MODULES()
    Dim fd As Object
    Dim folderPath As String
    Dim fso As Object, f As Object
    Dim imported As Long, skipped As String

    On Error GoTo NoAccess

    Set fd = Application.FileDialog(4)          ' msoFileDialogFolderPicker
    fd.Title = "Select the src\vba folder of the 3P 2.0 repository"
    If fd.Show <> -1 Then Exit Sub
    folderPath = fd.SelectedItems(1)

    Set fso = CreateObject("Scripting.FileSystemObject")
    If Not fso.FolderExists(folderPath) Then
        MsgBox "Folder not found.", vbExclamation
        Exit Sub
    End If

    ' Touching VBProject fails immediately when access is not trusted.
    If ThisWorkbook.VBProject.Name = vbNullString Then
    End If

    For Each f In fso.GetFolder(folderPath).Files
        Select Case LCase$(fso.GetExtensionName(f.Name))
            Case "bas", "cls", "frm"
                If ComponentExists(fso.GetBaseName(f.Name)) Then
                    skipped = skipped & "  " & f.Name & " (already present)" & vbCrLf
                Else
                    ThisWorkbook.VBProject.VBComponents.Import f.Path
                    imported = imported + 1
                End If
        End Select
    Next f

    MsgBox imported & " component(s) imported." & vbCrLf & vbCrLf & _
           IIf(Len(skipped) > 0, "Skipped:" & vbCrLf & skipped & vbCrLf, vbNullString) & _
           "Now run modBuilder.BUILD_3P_WORKBOOK.", vbInformation, "3P 2.0 import"
    Exit Sub

NoAccess:
    MsgBox "The modules could not be imported." & vbCrLf & vbCrLf & Err.Description & vbCrLf & vbCrLf & _
           "Tick File > Options > Trust Center > Trust Center Settings > Macro Settings >" & vbCrLf & _
           "'Trust access to the VBA project object model' and try again," & vbCrLf & _
           "or import the files by hand with Alt+F11 > File > Import File...", _
           vbCritical, "3P 2.0 import"
End Sub

Private Function ComponentExists(ByVal componentName As String) As Boolean
    Dim c As Object
    On Error Resume Next
    For Each c In ThisWorkbook.VBProject.VBComponents
        If StrComp(c.Name, componentName, vbTextCompare) = 0 Then
            ComponentExists = True
            Exit Function
        End If
    Next c
    On Error GoTo 0
End Function
