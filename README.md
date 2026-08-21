# vernier-management

## 3P 2.0 — Process Sheet Automation & Release Management System

Excel VBA + AutoCAD 2026 + Outlook automation for a Production Engineering
Department. The Excel workbook `3P_2.0_AUTOMATION.xlsm` is the master
controller; the `MASTER_LIST` sheet is the single source of truth for the status
of every part.

```
USER INPUT → ROUTE OK? → FOLDER STRUCTURE → PROCESS EXCEL → AUTOCAD DWG
   → ENGINEER EDITING → PDF OK? → PDF → MAIL OK? → OUTLOOK DISTRIBUTION
   → MAIL SENT → AUTOMATION COMPLETE
```

The system is a **state machine**, not a script: every stage reads the current
status from `MASTER_LIST` and continues from the first incomplete stage. Running
`RUN AUTOMATION` ten times produces exactly the same result as running it once —
no duplicate folders, no `PN-10025 (1).xlsx`, no duplicate drawings, no
accidental re-sends.

### What it does

| Stage | Result |
|-------|--------|
| 1. User input | Part Number, Revision, Customer, Route, Project Folder, DWG Template in `MASTER_LIST` |
| 2. Route OK? | `NO` → wait. Nothing on disk is touched. |
| 3. Folder structure | `Project Folder\Part Number\{DWG, Excel, PDF}` |
| 4. Process Excel | `<Part Number>.xlsx` with one formatted process sheet per route step, in route order |
| 5. AutoCAD drawing | Template opened, route blocks inserted in sequence, tables built from the Excel sheets, saved as `<Part Number>.dwg` |
| 6. Engineer editing | Manual, optional; recorded only when the engineer presses **MARK DWG AS EDITED** |
| 7. PDF OK? | `NO` → `PDF Status = Waiting` |
| 8. PDF | The latest **saved** DWG plotted to `<Part Number>.pdf` and verified on disk |
| 9. Mail OK? | `NO` → `Mail Status = Waiting` |
| 10. Outlook distribution | Recipients derived from the route via `PROCESS_OWNER_CONFIG`, PDF located and attached automatically, message displayed for review |
| 11. Final status | `Automation Status = Complete`, release date stamped, everything logged |

### Repository layout

```
src/vba/                    19 standard modules + 1 class (the system)
src/vba/document_modules/   code for ThisWorkbook, CONTROL_PANEL, MASTER_LIST
src/forms/                  frmAutomation code (built by modFormBuilder)
tools/Build-3P-Workbook.ps1 assembles 3P_2.0_AUTOMATION.xlsm from the sources
tools/modImporter.bas       in-Excel alternative to the PowerShell script
docs/                       setup, configuration, workflow, tests, architecture
```

### Build it

On a Windows machine with Excel (AutoCAD and Outlook are only needed at run
time), tick *File → Options → Trust Center → Trust Center Settings → Macro
Settings → Trust access to the VBA project object model*, then:

```powershell
powershell -ExecutionPolicy Bypass -File tools\Build-3P-Workbook.ps1
```

This produces `build\3P_2.0_AUTOMATION.xlsm` with every sheet, table, dropdown,
KPI card and button already in place, plus a sample part `PN-10025`.

Manual assembly (no PowerShell) is described in [docs/SETUP.md](docs/SETUP.md).

### Then configure

Only four sheets need your data — no VBA edits, ever:

| Sheet | What you set |
|-------|--------------|
| `CONFIG` | project root, DWG template, plot device, company/department, e-mail mode, subject and body templates |
| `PROCESS_CONFIG` | process codes, names, block names, Excel sheet names, X/Y, scale, rotation |
| `PROCESS_OWNER_CONFIG` | the real Outlook address of each process owner |
| `USER_CONFIG` | your name, employee ID, department, default project folder |

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for the complete checklist.

### Documentation

- [docs/SETUP.md](docs/SETUP.md) — installation and assembly, both routes
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) — every setting, what to change
- [docs/WORKFLOW.md](docs/WORKFLOW.md) — daily workflow, states, status values
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module map and procedure index
- [docs/USERFORM.md](docs/USERFORM.md) — `frmAutomation`, automatic and manual
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md) — acceptance tests and error tests
