VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "clsProcessStep"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
'==============================================================================
' Class       : clsProcessStep
' Purpose     : One step of a route, resolved against PROCESS_CONFIG and
'               carrying its position in the sequence. Used by the Excel
'               generator, the AutoCAD block inserter and the mail builder so
'               that all three read exactly the same definition.
'==============================================================================
Option Explicit

Public Code As String
Public Name As String
Public BlockName As String
Public SheetName As String
Public X As Double
Public Y As Double
Public ScaleX As Double
Public ScaleY As Double
Public Rotation As Double
Public Description As String
Public Owner As String
Public Sequence As Long

Public Sub Init(ByRef d As ProcessDef, ByVal seqNo As Long)
    Code = d.Code
    Name = d.Name
    BlockName = d.BlockName
    SheetName = d.SheetName
    X = d.X
    Y = d.Y
    ScaleX = d.ScaleX
    ScaleY = d.ScaleY
    Rotation = d.Rotation
    Description = d.Description
    Owner = d.Owner
    Sequence = seqNo
End Sub

'--- Insertion point, using the configured spacing when X is not supplied ------
Public Function EffectiveX(ByVal spacing As Double) As Double
    If X = 0 And Sequence > 1 Then
        EffectiveX = (Sequence - 1) * spacing
    Else
        EffectiveX = X
    End If
End Function
