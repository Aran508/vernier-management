# 3P 2.0 — Architecture

## Design rules

- `Option Explicit` in every module.
- No `Select` / `Activate` / `Selection` in the automation path — direct object
  references only (the workbook *builder* uses them deliberately, for freeze
  panes and window settings).
- Columns are addressed by **header name**, never by index, so `MASTER_LIST` can
  be re-ordered without touching code.
- No literal is repeated: sheet names, table names, column headers, status
  values and state numbers all live in `modConstants`.
- Nothing an engineer might change (paths, block names, positions, addresses,
  templates) is in the code — it is in `CONFIG`, `PROCESS_CONFIG`,
  `PROCESS_OWNER_CONFIG` or `USER_CONFIG`.
- No polling loops. Every wait (`WaitForFile`, `WaitForAcadReady`) is bounded by
  a configurable timeout; there is no `Do While True` anywhere.
- COM is late-bound (`CreateObject` / `GetObject`), so the workbook opens on a
  machine without AutoCAD or Outlook installed.

## Module map

| Module | Responsibility |
|--------|----------------|
| `modConstants` | Every sheet name, table name, column header, status value, action name and the `e3PState` enum |
| `modUtilities` | Sheet/table access, text and date helpers, dictionaries, message boxes, token replacement |
| `modFileSystem` | FileSystemObject wrapper: existence, size, permissions, path joining, name sanitising, backups, shell open, bounded file waits |
| `modConfig` | Typed read access to `CONFIG`, `USER_CONFIG`, `PROCESS_CONFIG`, `PROCESS_OWNER_CONFIG` (`ProcessDef`, `OwnerDef`) |
| `modMasterList` | All `tblMaster` reads/writes, row lookup, selected part, derived paths, new rows, search |
| `modRoute` | Route parsing, normalising and validation; ordered `clsProcessStep` collection |
| `clsProcessStep` | One resolved route step (code, name, block, sheet, position, scale, rotation, sequence) |
| `modValidation` | Field validation, recipient validation, attachment validation, approval gate |
| `modFolder` | Stage 3 — folder structure, reuse, reconciliation, backup folder |
| `modProcessExcel` | Stage 4 — generate/verify `<Part>.xlsx`, one formatted sheet per route step |
| `modAutoCAD` | Stage 5 — connect/start AutoCAD, open the template, metadata, save, verify; **MARK DWG AS EDITED** |
| `modBlocks` | Block existence checking and insertion in route order, attributes, XData tagging |
| `modAutoCADTables` | An AutoCAD table per process, filled from that process's Excel sheet, titled with the unique process ID |
| `modPDF` | Stage 8 — plot the latest saved DWG to PDF (`PlotToFile`, `-EXPORT` fallback), verify |
| `modOutlook` | Late-bound Outlook wrapper: create, attach, display, send, find in Sent Items |
| `modMail` | Stage 10 — recipients from the route, subject/body from templates, resend protection, `MARK MAIL AS SENT` |
| `modStatus` | The state machine: status updaters, change detection, `GetPartState`, final status |
| `modLogger` | `AUTOMATION_LOG` writer (never raises back into the caller) |
| `modErrorHandler` | Turns a trapped error into a `MASTER_LIST` stamp + log entry + message |
| `modDashboard` | `CONTROL_PANEL` cell map, selected-part panel, 12 KPI cards, search, progress box |
| `modMain` | `RunAutomation` state machine plus every button entry point, new part, reset, regenerate |
| `modBuilder` | Builds the entire workbook: sheets, tables, dropdowns, conditional formats, KPI cards, named ranges, buttons, README, sample data; `CheckSetup`, `CheckTemplateBlocks` |
| `modFormBuilder` | Creates `frmAutomation` (controls + code) through the VBIDE |

Document modules (pasted, not imported): `ThisWorkbook`, the `CONTROL_PANEL`
sheet and the `MASTER_LIST` sheet — see `src/vba/document_modules/`.

## Required procedures (topic 114) and where they live

| Procedure | Module |
|-----------|--------|
| `RunAutomation` | `modMain` |
| `ValidateSelectedPart` | `modValidation` |
| `ValidateRoute` | `modRoute` |
| `CreateProjectFolders` | `modFolder` |
| `CreateProcessExcel` | `modProcessExcel` |
| `CreateAutoCADDrawing` | `modAutoCAD` |
| `InsertProcessBlocks` | `modBlocks` |
| `UpdateAutoCADTables` | `modAutoCADTables` |
| `MarkDWGAsEdited` | `modAutoCAD` |
| `ConvertDWGToPDF` | `modPDF` |
| `BuildRecipientList`, `BuildMailTo`, `BuildMailCC`, `BuildMailSubject`, `BuildMailBody` | `modMail` |
| `GetProcessOwnerEmail` | `modConfig` |
| `CreateOutlookMail`, `AttachPDF`, `DisplayOutlookMail`, `SendOutlookMail` | `modOutlook` |
| `UpdateMailStatus`, `UpdateFinalStatus` | `modStatus` |
| `LogAction` | `modLogger` |
| `OpenProjectFolder` | `modFolder` |
| `OpenProcessExcel` | `modProcessExcel` |
| `OpenDWGFile` | `modAutoCAD` |
| `OpenPDFFile` | `modPDF` |
| `ResetForReprocess` | `modMain` |

## Control panel buttons and their macros

| Button | Macro |
|--------|-------|
| NEW PART | `modMain.btnNewPart` |
| VALIDATE ROUTE | `modMain.btnValidateRoute` |
| RUN AUTOMATION | `modMain.btnRunAutomation` |
| CREATE FOLDERS | `modMain.btnCreateFolders` |
| CREATE PROCESS EXCEL | `modMain.btnCreateProcessExcel` |
| CREATE AUTOCAD DWG | `modMain.btnCreateAutoCADDWG` |
| OPEN DWG | `modMain.btnOpenDWG` |
| MARK DWG AS EDITED | `modMain.btnMarkDWGAsEdited` |
| CONVERT TO PDF | `modMain.btnConvertToPDF` |
| SEND PDF | `modMain.btnSendPDF` |
| MARK MAIL AS SENT | `modMain.btnMarkMailAsSent` |
| MAIL NOT SENT | `modMain.btnMailCancelled` |
| REBUILD MAIL FIELDS | `modMain.btnRefreshMailFields` |
| OPEN PROJECT FOLDER / OPEN EXCEL / OPEN PDF | `modMain.btnOpenProjectFolder` / `btnOpenExcel` / `btnOpenPDF` |
| SEARCH / SELECT PART | `modMain.btnSearch` / `btnSelectPartFromList` |
| REFRESH DASHBOARD | `modMain.btnRefreshDashboard` |
| REGENERATE DWG / REGENERATE PDF | `modMain.RegenerateDWG` / `RegeneratePDF` |
| RESET / REPROCESS | `modMain.btnResetReprocess` |

## CONTROL_PANEL cell map

The map is declared once, as public constants in `modDashboard`, and `modBuilder`
draws the sheet from the same constants.

| Area | Cells |
|------|-------|
| Selected part | `C7` part, `C8` revision, `C9` customer, `C10` route, `C11` approval, `C12` status text, `C13` state |
| Stage status | `C16` folder, `C17` excel, `C18` dwg, `C19` pdf, `C20` mail, `C21` automation |
| Approval flags | `C24` Route OK, `C25` PDF OK, `C26` Mail OK, `C27` Mail Required |
| Files | `C30` project, `C31` excel, `C32` dwg, `C33` pdf |
| Search | `F7` field, `F8` text, results `E11:H25` |
| KPI cards | labels `E28..H28`, `E31..H31`, `E34..H34`; values one row below each |
| Progress | `B36:C58` |

Named ranges: `rngSelectedPart`, `rngSelectedRev`, `rngSearchField`,
`rngSearchText`, `rngProgress`.

## Data flow for the unique process identifier

```
MASTER_LIST row  ──►  ProcessUID(r, code) = "PN-10025-A-CT"
                        │
                        ├─► process sheet header cell  (Excel  B9)
                        ├─► block attribute PROCESS_ID (AutoCAD)
                        ├─► block XData under app "3P20"
                        └─► AutoCAD table title row
```

Because all four carry the same identifier, a table can never be attached to the
wrong process, and a block inserted for `PN-10025 Rev A` can never be confused
with one for `Rev B`.
