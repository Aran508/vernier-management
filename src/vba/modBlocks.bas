Attribute VB_Name = "modBlocks"
'==============================================================================
' Module      : modBlocks
' Purpose     : Process block handling inside the AutoCAD drawing.
'               Every block named in PROCESS_CONFIG is validated BEFORE any
'               insertion happens, so a missing block can never be silently
'               skipped. Topics 20, 21, 22, 96, 97, 98.
'==============================================================================
Option Explicit

Private Const XDATA_APP As String = "3P20"

'==============================================================================
' Topic 97 - block validation
'==============================================================================
Public Function BlockExistsInDrawing(ByVal doc As Object, ByVal blockName As String) As Boolean
    Dim blk As Object
    Dim wanted As String

    wanted = UCase$(Trim$(blockName))
    If Len(wanted) = 0 Then Exit Function

    On Error Resume Next
    Set blk = doc.Blocks.Item(blockName)
    If Err.Number = 0 And Not blk Is Nothing Then
        BlockExistsInDrawing = True
        Err.Clear
        On Error GoTo 0
        Exit Function
    End If
    Err.Clear

    ' Item() is case sensitive in some builds - fall back to a scan.
    For Each blk In doc.Blocks
        If UCase$(Trim$(blk.Name)) = wanted Then
            BlockExistsInDrawing = True
            Exit For
        End If
    Next blk
    Err.Clear
    On Error GoTo 0
End Function

'--- Validate the whole route up-front; returns the list of missing blocks -----
Public Function MissingBlocks(ByVal doc As Object, ByVal steps_ As Collection) As Collection
    Dim i As Long, c As Collection, s As clsProcessStep
    Set c = New Collection
    For i = 1 To steps_.Count
        Set s = steps_(i)
        If Len(Trim$(s.BlockName)) = 0 Then
            c.Add "(no Block Name configured for process " & s.Code & ")"
        ElseIf Not BlockExistsInDrawing(doc, s.BlockName) Then
            c.Add s.BlockName
        End If
    Next i
    Set MissingBlocks = c
End Function

'==============================================================================
' Topic 114 - InsertProcessBlocks
' Returns the number of blocks inserted; raises on the first problem.
'==============================================================================
Public Function InsertProcessBlocks(ByVal doc As Object, ByVal r As ListRow, _
                                    ByVal steps_ As Collection) As Long
    Dim missing As Collection
    Dim i As Long, s As clsProcessStep
    Dim blockRef As Object
    Dim spacing As Double
    Dim insPoint(0 To 2) As Double
    Dim rotRad As Double
    Dim count As Long

    '--- Topics 21 / 97 - validate every block first, then insert --------------
    Set missing = MissingBlocks(doc, steps_)
    If missing.Count > 0 Then
        Fail "modBlocks.InsertProcessBlocks", _
             "Process block " & missing(1) & " not found in AutoCAD template." & vbCrLf & vbCrLf & _
             IIf(missing.Count > 1, _
                 "All missing blocks:" & vbCrLf & JoinCollection(missing, vbCrLf) & vbCrLf & vbCrLf, _
                 vbNullString) & _
             "Template: " & TemplateFor(r) & vbCrLf & _
             "Block names are configured in PROCESS_CONFIG."
    End If

    spacing = GetConfigDouble(CFG_SPACING, 150)

    '--- Topics 8 / 96 - insert in exact route order ---------------------------
    For i = 1 To steps_.Count
        Set s = steps_(i)

        insPoint(0) = s.EffectiveX(spacing)
        insPoint(1) = s.Y
        insPoint(2) = 0#
        rotRad = s.Rotation * 3.14159265358979 / 180#

        Set blockRef = doc.ModelSpace.InsertBlock(insPoint, s.BlockName, _
                                                  s.ScaleX, s.ScaleY, s.ScaleX, rotRad)
        If blockRef Is Nothing Then
            Fail "modBlocks.InsertProcessBlocks", _
                 "AutoCAD refused to insert block " & s.BlockName & " (route step " & i & ")."
        End If

        FillBlockAttributes blockRef, r, s
        TagBlockWithProcessID doc, blockRef, ProcessUID(r, s.Code)

        count = count + 1
        Set blockRef = Nothing
    Next i

    On Error Resume Next
    doc.Regen 1                      ' acAllViewports
    On Error GoTo 0

    InsertProcessBlocks = count
End Function

'==============================================================================
' Topic 23 - the block carries the identifiers that tie it to its Excel sheet
'==============================================================================
Private Sub FillBlockAttributes(ByVal blockRef As Object, ByVal r As ListRow, _
                                ByVal s As clsProcessStep)
    Dim tokens As Object
    Dim atts As Variant, i As Long, tagName As String

    On Error Resume Next
    If Not blockRef.HasAttributes Then
        Err.Clear
        Exit Sub
    End If

    Set tokens = NewDictionary()
    tokens("PROCESS_ID") = ProcessUID(r, s.Code)
    tokens("PROCESSID") = ProcessUID(r, s.Code)
    tokens("PROCESS_CODE") = s.Code
    tokens("CODE") = s.Code
    tokens("PROCESS_NAME") = s.Name
    tokens("PROCESS") = s.Name
    tokens("SEQ") = CStr(s.Sequence)
    tokens("SEQUENCE") = CStr(s.Sequence)
    tokens("STEP") = CStr(s.Sequence)
    tokens("PART_NUMBER") = MLGetStr(r, COL_PARTNO)
    tokens("PARTNUMBER") = MLGetStr(r, COL_PARTNO)
    tokens("REVISION") = MLGetStr(r, COL_REVISION)
    tokens("REV") = MLGetStr(r, COL_REVISION)
    tokens("CUSTOMER") = MLGetStr(r, COL_CUSTOMER)
    tokens("ROUTE") = MLGetStr(r, COL_ROUTE)
    tokens("EXCEL_SHEET") = s.SheetName
    tokens("EXCEL_FILE") = ExcelFileFor(r)
    tokens("OWNER") = s.Owner
    tokens("DESCRIPTION") = s.Description
    tokens("DATE") = Format$(Date, "dd-mmm-yyyy")

    atts = blockRef.GetAttributes
    For i = LBound(atts) To UBound(atts)
        tagName = UCase$(Trim$(atts(i).TagString))
        If tokens.Exists(tagName) Then atts(i).TextString = CStr(tokens(tagName))
    Next i
    Err.Clear
    On Error GoTo 0
End Sub

'--- Stamp the unique process identifier into the block reference's XData so it
'    remains identifiable even after the drawing is edited by hand.
Private Sub TagBlockWithProcessID(ByVal doc As Object, ByVal blockRef As Object, _
                                  ByVal processUID As String)
    Dim dataType(0 To 1) As Integer
    Dim dataValue(0 To 1) As Variant

    On Error Resume Next
    doc.RegisteredApplications.Add XDATA_APP
    Err.Clear

    dataType(0) = 1001: dataValue(0) = XDATA_APP     ' registered application name
    dataType(1) = 1000: dataValue(1) = processUID    ' string value

    blockRef.SetXData dataType, dataValue
    Err.Clear
    On Error GoTo 0
End Sub

'--- Find a previously inserted process block by its unique identifier ---------
Public Function FindBlockByProcessID(ByVal doc As Object, ByVal processUID As String) As Object
    Dim ent As Object, xdType As Variant, xdVal As Variant, i As Long

    On Error Resume Next
    For Each ent In doc.ModelSpace
        ent.GetXData XDATA_APP, xdType, xdVal
        If Err.Number = 0 Then
            If Not IsEmpty(xdVal) Then
                For i = LBound(xdVal) To UBound(xdVal)
                    If VarType(xdVal(i)) = vbString Then
                        If StrComp(CStr(xdVal(i)), processUID, vbTextCompare) = 0 Then
                            Set FindBlockByProcessID = ent
                            Err.Clear
                            On Error GoTo 0
                            Exit Function
                        End If
                    End If
                Next i
            End If
        End If
        Err.Clear
    Next ent
    Err.Clear
    On Error GoTo 0
End Function

'--- Diagnostic used by the setup checker: which configured blocks are present -
Public Function BlockAvailabilityReport(ByVal templatePath As String) As String
    Dim acadApp As Object, doc As Object
    Dim codes As Collection, i As Long, d As ProcessDef
    Dim report As String

    On Error GoTo Failed

    If Not FileExists(templatePath) Then
        BlockAvailabilityReport = "Template not found: " & templatePath
        Exit Function
    End If

    Set acadApp = GetAcadApp(True)
    Set doc = acadApp.Documents.Open(templatePath, True)
    WaitForAcadReady acadApp

    Set codes = ValidProcessCodes()
    For i = 1 To codes.Count
        d = GetProcessDef(codes(i))
        report = report & d.Code & "  ->  " & d.BlockName & "  :  " & _
                 IIf(BlockExistsInDrawing(doc, d.BlockName), "FOUND", "*** MISSING ***") & vbCrLf
    Next i

    On Error Resume Next
    doc.Close False
    On Error GoTo 0

    BlockAvailabilityReport = report
    Exit Function

Failed:
    BlockAvailabilityReport = "Could not inspect the template: " & Err.Description
End Function
