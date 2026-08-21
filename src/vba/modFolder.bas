Attribute VB_Name = "modFolder"
'==============================================================================
' Module      : modFolder
' Purpose     : Stage 3 - project folder structure.
'               Project Folder \ Part Number \ {DWG, Excel, PDF}
'               Existing folders are reused, never duplicated.
'               Topics 11, 12, 101.
'==============================================================================
Option Explicit

'==============================================================================
' Topic 114 - CreateProjectFolders. Returns True when the structure is present.
'==============================================================================
Public Function CreateProjectFolders(ByVal r As ListRow, _
                                     Optional ByVal announce As Boolean = False) As Boolean
    Dim projPath As String, dwgPath As String, xlPath As String, pdfPath As String
    Dim prev As String

    On Error GoTo ErrorHandler

    If r Is Nothing Then Exit Function
    prev = MLGetStr(r, COL_FOLDERSTATUS)

    projPath = ProjectPathFor(r)
    If Len(projPath) = 0 Then
        Fail "modFolder.CreateProjectFolders", _
             "Project Folder / Part Number is missing - the project path cannot be built."
    End If

    dwgPath = DwgFolderFor(r)
    xlPath = ExcelFolderFor(r)
    pdfPath = PdfFolderFor(r)

    SetStatusBar "Creating folder structure for " & MLGetStr(r, COL_PARTNO) & " ..."

    If Not EnsureFolder(projPath) Then
        Fail "modFolder.CreateProjectFolders", "Could not create project folder:" & vbCrLf & projPath
    End If
    If Not EnsureFolder(dwgPath) Then
        Fail "modFolder.CreateProjectFolders", "Could not create DWG folder:" & vbCrLf & dwgPath
    End If
    If Not EnsureFolder(xlPath) Then
        Fail "modFolder.CreateProjectFolders", "Could not create Excel folder:" & vbCrLf & xlPath
    End If
    If Not EnsureFolder(pdfPath) Then
        Fail "modFolder.CreateProjectFolders", "Could not create PDF folder:" & vbCrLf & pdfPath
    End If

    MLSet r, COL_PROJECTPATH, projPath
    ClearError r
    UpdateFolderStatus r, ST_CREATED, ACT_FOLDER, RES_OK
    SetStatusBar vbNullString

    If announce Then
        InfoBox "Folder structure ready:" & vbCrLf & vbCrLf & _
                projPath & vbCrLf & _
                "   +-- " & FLD_DWG & vbCrLf & _
                "   +-- " & FLD_EXCEL & vbCrLf & _
                "   +-- " & FLD_PDF
    End If

    CreateProjectFolders = True
    Exit Function

ErrorHandler:
    SetStatusBar vbNullString
    RecordError r, ACT_FOLDER, ErrText("modFolder.CreateProjectFolders"), COL_FOLDERSTATUS, announce
End Function

'--- True when every required folder is present on disk ------------------------
Public Function FolderStructureComplete(ByVal r As ListRow) As Boolean
    FolderStructureComplete = FolderExists(ProjectPathFor(r)) _
                              And FolderExists(DwgFolderFor(r)) _
                              And FolderExists(ExcelFolderFor(r)) _
                              And FolderExists(PdfFolderFor(r))
End Function

'--- Topic 12: reconcile the recorded status with what is really on disk -------
Public Sub ReconcileFolderStatus(ByVal r As ListRow)
    If r Is Nothing Then Exit Sub
    If FolderStructureComplete(r) Then
        If MLGetStr(r, COL_FOLDERSTATUS) <> ST_CREATED Then
            UpdateFolderStatus r, ST_CREATED, ACT_FOLDER, RES_INFO
        End If
    ElseIf MLGetStr(r, COL_FOLDERSTATUS) = ST_CREATED Then
        UpdateFolderStatus r, ST_NOTSTARTED, ACT_FOLDER, RES_INFO, _
                           "Folder structure is no longer present on disk."
    End If
End Sub

'--- Topic 114 - OpenProjectFolder ---------------------------------------------
Public Sub OpenProjectFolder()
    Dim r As ListRow, p As String
    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub
    p = ProjectPathFor(r)
    If Not FolderExists(p) Then
        WarnBox "The project folder has not been created yet:" & vbCrLf & vbCrLf & p
        Exit Sub
    End If
    ShellOpen p
End Sub

'--- Ensure the Backup sub-folder exists (topics 50, 91) -----------------------
Public Function EnsureBackupFolder(ByVal r As ListRow) As String
    Dim p As String
    p = BackupFolderFor(r)
    If EnsureFolder(p) Then EnsureBackupFolder = p
End Function
