Attribute VB_Name = "modFileSystem"
'==============================================================================
' Module      : modFileSystem
' Purpose     : All disk access goes through here - folder creation, existence
'               checks, name sanitising, backups and "open in Windows" helpers.
'               Topics 12, 50, 91, 92, 101.
'==============================================================================
Option Explicit

Private mFSO As Object

'--- Shared FileSystemObject ---------------------------------------------------
Public Function FSO() As Object
    If mFSO Is Nothing Then Set mFSO = CreateObject("Scripting.FileSystemObject")
    Set FSO = mFSO
End Function

Public Function FolderExists(ByVal folderPath As String) As Boolean
    If Len(Trim$(folderPath)) = 0 Then Exit Function
    On Error Resume Next
    FolderExists = FSO.FolderExists(folderPath)
    On Error GoTo 0
End Function

Public Function FileExists(ByVal filePath As String) As Boolean
    If Len(Trim$(filePath)) = 0 Then Exit Function
    On Error Resume Next
    FileExists = FSO.FileExists(filePath)
    On Error GoTo 0
End Function

Public Function FileSizeBytes(ByVal filePath As String) As Double
    On Error Resume Next
    If FileExists(filePath) Then FileSizeBytes = FSO.GetFile(filePath).Size
    On Error GoTo 0
End Function

Public Function FileModified(ByVal filePath As String) As Date
    On Error Resume Next
    If FileExists(filePath) Then FileModified = FSO.GetFile(filePath).DateLastModified
    On Error GoTo 0
End Function

'--- Join path parts without doubling or dropping separators -------------------
Public Function PathJoin(ParamArray parts() As Variant) As String
    Dim i As Long, s As String, p As String
    For i = LBound(parts) To UBound(parts)
        p = Trim$(CStr(parts(i)))
        If Len(p) > 0 Then
            If Len(s) = 0 Then
                s = p
            Else
                If Right$(s, 1) <> "\" Then s = s & "\"
                Do While Left$(p, 1) = "\"
                    p = Mid$(p, 2)
                Loop
                s = s & p
            End If
        End If
    Next i
    PathJoin = s
End Function

'--- Topic 92: strip characters Windows will not accept in a file name ---------
Public Function SanitizeFileName(ByVal rawName As String) As String
    Dim bad As Variant, i As Long, s As String
    s = Trim$(rawName)
    bad = Array("\", "/", ":", "*", "?", """", "<", ">", "|")
    For i = LBound(bad) To UBound(bad)
        s = Replace$(s, CStr(bad(i)), "_")
    Next i
    ' Control characters and trailing dots/spaces are also illegal.
    For i = 1 To 31
        s = Replace$(s, Chr$(i), vbNullString)
    Next i
    Do While Len(s) > 0 And (Right$(s, 1) = "." Or Right$(s, 1) = " ")
        s = Left$(s, Len(s) - 1)
    Loop
    SanitizeFileName = s
End Function

Public Function ContainsIllegalFileChars(ByVal rawName As String) As Boolean
    ContainsIllegalFileChars = (SanitizeFileName(rawName) <> Trim$(rawName))
End Function

'--- Create a folder, building any missing parents. Existing folders are reused
'    (topics 12 and 101 - never create PN-10025(1)).
Public Function EnsureFolder(ByVal folderPath As String) As Boolean
    Dim parentPath As String
    If Len(Trim$(folderPath)) = 0 Then Exit Function
    If FolderExists(folderPath) Then
        EnsureFolder = True
        Exit Function
    End If
    parentPath = FSO.GetParentFolderName(folderPath)
    If Len(parentPath) > 0 Then
        If Not FolderExists(parentPath) Then
            If Not EnsureFolder(parentPath) Then Exit Function
        End If
    End If
    FSO.CreateFolder folderPath
    EnsureFolder = FolderExists(folderPath)
End Function

'--- True when the folder can actually be written to (permission check) --------
Public Function FolderIsWritable(ByVal folderPath As String) As Boolean
    Dim probe As String, ts As Object
    If Not FolderExists(folderPath) Then Exit Function
    probe = PathJoin(folderPath, "~3p_write_test_" & TimeStampCompact() & ".tmp")
    On Error GoTo Nope
    Set ts = FSO.CreateTextFile(probe, True)
    ts.Write "3P"
    ts.Close
    FSO.DeleteFile probe, True
    FolderIsWritable = True
    Exit Function
Nope:
    On Error Resume Next
    If Not ts Is Nothing Then ts.Close
    If FileExists(probe) Then FSO.DeleteFile probe, True
    On Error GoTo 0
End Function

'--- True when a file is not locked by another application ---------------------
Public Function FileIsAccessible(ByVal filePath As String) As Boolean
    Dim fNum As Integer
    If Not FileExists(filePath) Then Exit Function
    On Error GoTo Locked
    fNum = FreeFile
    Open filePath For Binary Access Read Lock Write As #fNum
    Close #fNum
    FileIsAccessible = True
    Exit Function
Locked:
    On Error Resume Next
    Close #fNum
    On Error GoTo 0
End Function

'--- Topics 50/91: timestamped backup, production files are never deleted ------
Public Function BackupFile(ByVal filePath As String, ByVal backupFolder As String) As String
    Dim baseName As String, ext As String, target As String
    If Not FileExists(filePath) Then Exit Function
    If Not EnsureFolder(backupFolder) Then Exit Function
    baseName = FSO.GetBaseName(filePath)
    ext = FSO.GetExtensionName(filePath)
    target = PathJoin(backupFolder, baseName & "_" & TimeStampCompact() & "." & ext)
    FSO.CopyFile filePath, target, False
    If FileExists(target) Then BackupFile = target
End Function

'--- Open a folder / document with the Windows shell ---------------------------
Public Sub ShellOpen(ByVal target As String)
    If Len(Trim$(target)) = 0 Then
        WarnBox "Nothing to open - the path is empty."
        Exit Sub
    End If
    If Not (FileExists(target) Or FolderExists(target)) Then
        WarnBox "Not found on disk:" & vbCrLf & vbCrLf & target
        Exit Sub
    End If
    On Error GoTo Failed
    Shell "explorer.exe """ & target & """", vbNormalFocus
    Exit Sub
Failed:
    ErrorBox "Windows could not open:" & vbCrLf & vbCrLf & target & vbCrLf & vbCrLf & Err.Description
End Sub

'--- Bounded wait for a file to appear. No endless loop (topic 46) -------------
Public Function WaitForFile(ByVal filePath As String, ByVal timeoutSeconds As Double) As Boolean
    Dim startedAt As Double
    startedAt = Timer
    Do
        If FileExists(filePath) Then
            If FileSizeBytes(filePath) > 0 Then
                WaitForFile = True
                Exit Function
            End If
        End If
        DoEvents
        ' Timer resets at midnight - treat a negative delta as "start again".
        If Timer < startedAt Then startedAt = Timer
    Loop While (Timer - startedAt) < timeoutSeconds
End Function
