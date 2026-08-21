Attribute VB_Name = "modRoute"
'==============================================================================
' Module      : modRoute
' Purpose     : Route parsing and validation. The route is the backbone of the
'               whole system - it decides Excel sheets, AutoCAD blocks and mail
'               recipients. Topics 7, 8, 9, 10, 72.
'==============================================================================
Option Explicit

'--- Split "CT-FC-CH-ET-WD" into an ordered collection of clean codes ----------
Public Function ParseRoute(ByVal routeText As String) As Collection
    Dim parts As Variant, i As Long, code As String
    Dim c As Collection

    Set c = New Collection
    If Len(Trim$(routeText)) = 0 Then
        Set ParseRoute = c
        Exit Function
    End If

    ' Tolerate the separators engineers actually type.
    routeText = Replace$(routeText, "->", "-")
    routeText = Replace$(routeText, "/", "-")
    routeText = Replace$(routeText, ",", "-")
    routeText = Replace$(routeText, " ", vbNullString)

    parts = Split(UCase$(Trim$(routeText)), "-")
    For i = LBound(parts) To UBound(parts)
        code = Trim$(CStr(parts(i)))
        If Len(code) > 0 Then c.Add code
    Next i

    Set ParseRoute = c
End Function

'--- Canonical form written back to MASTER_LIST --------------------------------
Public Function NormalizeRoute(ByVal routeText As String) As String
    NormalizeRoute = JoinCollection(ParseRoute(routeText), "-")
End Function

Public Function RouteStepCount(ByVal routeText As String) As Long
    RouteStepCount = ParseRoute(routeText).Count
End Function

'==============================================================================
' Core route validation (topic 9). Returns True/False and fills errMsg with a
' message that can be shown to the operator as-is.
'==============================================================================
Public Function ValidateRouteString(ByVal routeText As String, ByRef errMsg As String) As Boolean
    Dim codes As Collection, i As Long, code As String
    Dim badCodes As Collection, dupCodes As Collection, disabled As Collection
    Dim seen As Object
    Dim msg As String

    errMsg = vbNullString

    If Len(Trim$(routeText)) = 0 Then
        errMsg = "ROUTE VALIDATION FAILED" & vbCrLf & vbCrLf & "The Route is blank."
        Exit Function
    End If

    Set codes = ParseRoute(routeText)
    If codes.Count = 0 Then
        errMsg = "ROUTE VALIDATION FAILED" & vbCrLf & vbCrLf & _
                 "No process codes could be read from: " & routeText
        Exit Function
    End If

    Set badCodes = New Collection
    Set dupCodes = New Collection
    Set disabled = New Collection
    Set seen = NewDictionary()

    For i = 1 To codes.Count
        code = codes(i)
        If Not ProcessCodeExists(code) Then
            badCodes.Add code
        ElseIf Not ProcessCodeEnabled(code) Then
            disabled.Add code
        End If
        If seen.Exists(code) Then
            If Not AllowDuplicateProcessCodes() Then dupCodes.Add code
        Else
            seen(code) = 1
        End If
    Next i

    If badCodes.Count > 0 Then
        msg = "ROUTE VALIDATION FAILED" & vbCrLf & vbCrLf & _
              "Invalid process code" & IIf(badCodes.Count > 1, "s", vbNullString) & ":" & vbCrLf & _
              JoinCollection(badCodes, vbCrLf) & vbCrLf & vbCrLf & _
              "Valid process codes:" & vbCrLf & ValidProcessCodeList()
        errMsg = msg
        Exit Function
    End If

    If disabled.Count > 0 Then
        errMsg = "ROUTE VALIDATION FAILED" & vbCrLf & vbCrLf & _
                 "Process code" & IIf(disabled.Count > 1, "s are", " is") & _
                 " disabled in PROCESS_CONFIG:" & vbCrLf & _
                 JoinCollection(disabled, vbCrLf) & vbCrLf & vbCrLf & _
                 "Set Enabled = YES in PROCESS_CONFIG, or correct the Route."
        Exit Function
    End If

    If dupCodes.Count > 0 Then
        errMsg = "ROUTE VALIDATION FAILED" & vbCrLf & vbCrLf & _
                 "Duplicate process code" & IIf(dupCodes.Count > 1, "s", vbNullString) & ":" & vbCrLf & _
                 JoinCollection(dupCodes, vbCrLf) & vbCrLf & vbCrLf & _
                 "Duplicates are not permitted. To allow them set '" & CFG_ALLOWDUPPROC & _
                 "' = YES in CONFIG."
        Exit Function
    End If

    ValidateRouteString = True
End Function

'==============================================================================
' Full validation of a MASTER_LIST row - route plus the fields the route work
' depends on (topics 9 and 72).
'==============================================================================
Public Function ValidateRowRoute(ByVal r As ListRow, ByRef errMsg As String) As Boolean
    Dim fieldMsg As String, routeMsg As String
    Dim ok As Boolean

    errMsg = vbNullString
    If r Is Nothing Then
        errMsg = "No part row supplied."
        Exit Function
    End If

    ok = ValidatePartFields(r, fieldMsg)
    If Not ok Then
        errMsg = fieldMsg
        Exit Function
    End If

    If Not ValidateRouteString(MLGetStr(r, COL_ROUTE), routeMsg) Then
        errMsg = routeMsg
        Exit Function
    End If

    ' Write the cleaned-up route back so the sheet stays canonical.
    MLSet r, COL_ROUTE, NormalizeRoute(MLGetStr(r, COL_ROUTE))
    ValidateRowRoute = True
End Function

'==============================================================================
' Topic 72 - VALIDATE ROUTE button
'==============================================================================
Public Sub ValidateRoute()
    Dim r As ListRow, msg As String
    Dim codes As Collection, i As Long, detail As String
    Dim d As ProcessDef

    On Error GoTo ErrorHandler

    Set r = GetSelectedRow()
    If r Is Nothing Then Exit Sub

    If Not ValidateRowRoute(r, msg) Then
        LogRowAction r, ACT_VALIDATE, vbNullString, "INVALID", RES_FAIL, Replace$(msg, vbCrLf, " ")
        MLSet r, COL_ERRORSTATUS, "ERROR"
        MLSet r, COL_ERRORMSG, Replace$(msg, vbCrLf, " ")
        MLTouch r, ACT_VALIDATE
        ErrorBox msg
        modDashboard.RefreshDashboard
        Exit Sub
    End If

    Set codes = ParseRoute(MLGetStr(r, COL_ROUTE))
    For i = 1 To codes.Count
        d = GetProcessDef(codes(i))
        detail = detail & vbCrLf & "  " & i & ". " & d.Code & "  -  " & d.Name & _
                 "   [block " & d.BlockName & " | sheet " & d.SheetName & "]"
    Next i

    ClearError r
    MLTouch r, ACT_VALIDATE
    LogRowAction r, ACT_VALIDATE, vbNullString, "VALID", RES_OK

    InfoBox "ROUTE VALIDATION PASSED" & vbCrLf & vbCrLf & _
            "Part Number : " & MLGetStr(r, COL_PARTNO) & vbCrLf & _
            "Revision    : " & MLGetStr(r, COL_REVISION) & vbCrLf & _
            "Customer    : " & MLGetStr(r, COL_CUSTOMER) & vbCrLf & _
            "Route       : " & MLGetStr(r, COL_ROUTE) & vbCrLf & vbCrLf & _
            codes.Count & " process step(s):" & detail

    modDashboard.RefreshDashboard
    Exit Sub

ErrorHandler:
    RecordError r, ACT_VALIDATE, ErrText("modRoute.ValidateRoute")
End Sub

'--- Ordered process definitions for a row, ready for Excel/DWG/mail work ------
Public Function RouteProcessDefs(ByVal r As ListRow) As Collection
    Dim codes As Collection, i As Long, c As Collection
    Dim d As ProcessDef, holder As Object

    Set c = New Collection
    Set codes = ParseRoute(MLGetStr(r, COL_ROUTE))
    For i = 1 To codes.Count
        d = GetProcessDef(codes(i))
        If d.Found Then
            Set holder = New clsProcessStep
            holder.Init d, i
            c.Add holder
        End If
    Next i
    Set RouteProcessDefs = c
End Function
