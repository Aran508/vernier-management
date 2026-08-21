<#
.SYNOPSIS
    Assembles 3P_2.0_AUTOMATION.xlsm from the VBA sources in this repository.

.DESCRIPTION
    Creates a new macro-enabled workbook, imports every module and class from
    src\vba, pastes the three document modules (ThisWorkbook, CONTROL_PANEL and
    MASTER_LIST), runs the workbook builder and finally builds frmAutomation.

    Requirements (Windows, once per machine):
      * Microsoft Excel desktop.
      * File > Options > Trust Center > Trust Center Settings > Macro Settings
        > "Trust access to the VBA project object model"  ->  ticked.

    Nothing here needs AutoCAD or Outlook - those are only used at run time.

.PARAMETER OutputPath
    Where to write the workbook. Defaults to
    <repo>\build\3P_2.0_AUTOMATION.xlsm

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\Build-3P-Workbook.ps1
#>

[CmdletBinding()]
param(
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$vbaDir   = Join-Path $repoRoot 'src\vba'
$docDir   = Join-Path $vbaDir  'document_modules'

if (-not $OutputPath) {
    $buildDir = Join-Path $repoRoot 'build'
    if (-not (Test-Path $buildDir)) { New-Item -ItemType Directory -Path $buildDir | Out-Null }
    $OutputPath = Join-Path $buildDir '3P_2.0_AUTOMATION.xlsm'
}

if (Test-Path $OutputPath) {
    Write-Host "Removing the previous build: $OutputPath"
    Remove-Item $OutputPath -Force
}

Write-Host 'Starting Excel...'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $true
$excel.DisplayAlerts = $false

try {
    $wb = $excel.Workbooks.Add()

    # --- Verify we are allowed to touch the VBA project -----------------------
    try {
        $null = $wb.VBProject.Name
    } catch {
        throw "Access to the VBA project is blocked. Tick 'Trust access to the VBA " +
              "project object model' in Excel's Trust Center, then run this script again."
    }

    # --- Import standard modules and classes ---------------------------------
    Get-ChildItem -Path $vbaDir -Filter '*.bas' | Sort-Object Name | ForEach-Object {
        Write-Host "  importing $($_.Name)"
        $wb.VBProject.VBComponents.Import($_.FullName) | Out-Null
    }
    Get-ChildItem -Path $vbaDir -Filter '*.cls' | Sort-Object Name | ForEach-Object {
        Write-Host "  importing $($_.Name)"
        $wb.VBProject.VBComponents.Import($_.FullName) | Out-Null
    }

    # --- ThisWorkbook document module ----------------------------------------
    $thisWbCode = Get-Content (Join-Path $docDir 'ThisWorkbook.cls.txt') -Raw
    $wb.VBProject.VBComponents('ThisWorkbook').CodeModule.AddFromString($thisWbCode)

    # --- Save as .xlsm (52 = xlOpenXMLWorkbookMacroEnabled) ------------------
    Write-Host "Saving $OutputPath"
    $wb.SaveAs($OutputPath, 52)

    # --- Build the sheets, tables, dashboard and buttons ---------------------
    Write-Host 'Building the workbook structure...'
    $excel.Run('BUILD_3P_WORKBOOK_SILENT')

    # --- Worksheet document modules (the sheets exist only now) --------------
    $panelCode  = Get-Content (Join-Path $docDir 'Sheet_CONTROL_PANEL.cls.txt') -Raw
    $masterCode = Get-Content (Join-Path $docDir 'Sheet_MASTER_LIST.cls.txt')  -Raw

    $panelComp  = $wb.VBProject.VBComponents($wb.Worksheets('CONTROL_PANEL').CodeName)
    $masterComp = $wb.VBProject.VBComponents($wb.Worksheets('MASTER_LIST').CodeName)
    $panelComp.CodeModule.AddFromString($panelCode)
    $masterComp.CodeModule.AddFromString($masterCode)

    # --- frmAutomation --------------------------------------------------------
    Write-Host 'Building frmAutomation...'
    try {
        $excel.Run('BUILD_AUTOMATION_FORM')
    } catch {
        Write-Warning "frmAutomation could not be built: $($_.Exception.Message)"
        Write-Warning "The system still works - NEW PART falls back to guided prompts."
    }

    $wb.Save()
    Write-Host ''
    Write-Host "Done: $OutputPath" -ForegroundColor Green
    Write-Host 'Next: open the workbook and fill in CONFIG, PROCESS_CONFIG,'
    Write-Host '      PROCESS_OWNER_CONFIG and USER_CONFIG.'
}
finally {
    $excel.DisplayAlerts = $true
    # Excel is deliberately left open so the result can be inspected.
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
