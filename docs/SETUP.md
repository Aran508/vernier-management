# 3P 2.0 — Setup

## 1. Prerequisites

| Component | Requirement |
|-----------|-------------|
| OS | Windows (the automation uses COM) |
| Excel | Microsoft Excel desktop, macro-enabled workbooks allowed |
| AutoCAD | AutoCAD 2026 (or the release named in `CONFIG → AutoCAD Application`) |
| Outlook | Microsoft Outlook desktop, signed in |

Excel one-time setting, needed only to **build** the workbook:

> File → Options → Trust Center → Trust Center Settings → Macro Settings →
> **Trust access to the VBA project object model** ✔

(The finished workbook does not need this setting to run — only the build step
and `BUILD_AUTOMATION_FORM` do.)

## 2. Assemble the workbook — automatic

```powershell
powershell -ExecutionPolicy Bypass -File tools\Build-3P-Workbook.ps1
```

The script:

1. starts Excel and creates a new workbook,
2. imports every `.bas` and `.cls` from `src/vba`,
3. pastes `ThisWorkbook` code,
4. saves as `build\3P_2.0_AUTOMATION.xlsm`,
5. runs `BUILD_3P_WORKBOOK_SILENT` — all sheets, tables, dropdowns, conditional
   formats, KPI cards, named ranges and buttons,
6. pastes the `CONTROL_PANEL` and `MASTER_LIST` worksheet code,
7. runs `BUILD_AUTOMATION_FORM` to create `frmAutomation`,
8. saves.

Pass `-OutputPath` to write somewhere else.

## 3. Assemble the workbook — manual

1. New workbook → **Save As** → `3P_2.0_AUTOMATION.xlsm`
   (*Excel Macro-Enabled Workbook*).
2. `Alt+F11` → **File → Import File…** and import, from `src/vba`:

   ```
   clsProcessStep.cls
   modAutoCAD.bas          modAutoCADTables.bas    modBlocks.bas
   modBuilder.bas          modConfig.bas           modConstants.bas
   modDashboard.bas        modErrorHandler.bas     modFileSystem.bas
   modFolder.bas           modFormBuilder.bas      modLogger.bas
   modMail.bas             modMain.bas             modMasterList.bas
   modOutlook.bas          modPDF.bas              modProcessExcel.bas
   modRoute.bas            modStatus.bas           modUtilities.bas
   modValidation.bas
   ```

   (`tools/modImporter.bas` can do this for you: import it, run
   `IMPORT_3P_MODULES`, point it at `src/vba`, then remove it again.)

3. In the VBA editor, open **ThisWorkbook** and paste the contents of
   `src/vba/document_modules/ThisWorkbook.cls.txt`.
4. Run `modBuilder.BUILD_3P_WORKBOOK` (`Alt+F8` → run). Answer the two
   questions; the whole workbook is built.
5. Open the **CONTROL_PANEL** worksheet module (double-click the sheet in the
   Project Explorer) and paste
   `src/vba/document_modules/Sheet_CONTROL_PANEL.cls.txt`.
6. Do the same for **MASTER_LIST** with
   `src/vba/document_modules/Sheet_MASTER_LIST.cls.txt`.
7. Run `modFormBuilder.BUILD_AUTOMATION_FORM` (optional — see
   [USERFORM.md](USERFORM.md)).
8. Save.

## 4. Verify the installation

From `Alt+F8`:

| Macro | What it checks |
|-------|----------------|
| `CheckSetup` | project root exists, template exists, e-mail mode, owner addresses, Outlook |
| `CheckTemplateBlocks` | opens the configured template and reports FOUND / MISSING for every block in `PROCESS_CONFIG` |

Both report their findings in a message box; nothing is changed.

## 5. AutoCAD template

The template named in `CONFIG → Default DWG Template` (or per-part in
`MASTER_LIST → DWG Template`) must contain one block per process code, named as
in `PROCESS_CONFIG → Block Name` — by default `BLK_CT`, `BLK_FC`, `BLK_CH`,
`BLK_ET`, `BLK_WD`.

Optional but recommended: give the blocks and the title block attributes with
these tags. Any tag that is present is filled in automatically; missing tags are
ignored.

| Tag | Filled with |
|-----|-------------|
| `PROCESS_ID` | `PN-10025-A-CT` (Part Number + Revision + Process Code) |
| `PROCESS_CODE`, `PROCESS_NAME`, `SEQ` | route step details |
| `PART_NUMBER`, `REVISION`, `CUSTOMER`, `ROUTE` | part details |
| `EXCEL_SHEET`, `EXCEL_FILE` | the linked process sheet and workbook |
| `PREPARED_BY`, `APPROVED_BY`, `DATE`, `COMPANY`, `DEPARTMENT` | title block |

Every inserted block also carries its `PROCESS_ID` as XData under the
application name `3P20`, so it stays identifiable after manual editing.

## 6. Uninstall / upgrade

The workbook holds all data; the modules hold no state. To upgrade, import the
new `.bas` files over the old ones (delete the old components first) and run
`BUILD_3P_WORKBOOK` again — answer **No** to “erase the existing part data” and
your `MASTER_LIST` rows are captured and restored around the rebuild.
