# frmAutomation

The form is optional. `NEW PART` uses it when it exists and falls back to a
guided sequence of prompts when it does not, so the system is fully usable
either way. Nothing in the project references the form at compile time —
`modMain.ShowAutomationForm` creates it through `VBA.UserForms.Add`, so the
project always compiles.

## Automatic creation (recommended)

1. Tick *File → Options → Trust Center → Trust Center Settings → Macro Settings
   → Trust access to the VBA project object model*.
2. `Alt+F8` → run **`BUILD_AUTOMATION_FORM`**.

The module creates the form, all 28 controls and the complete code module. If
access is blocked it tells you exactly what to enable.

## Manual creation

`Alt+F11` → *Insert → UserForm*. Set the form's properties:

| Property | Value |
|----------|-------|
| `(Name)` | `frmAutomation` |
| `Caption` | `3P 2.0 - Part Entry / Run Automation` |
| `Width` | `510` |
| `Height` | `380` |

Then add the controls below. Positions are in points; only the **names** matter
for the code to work.

| Type | Name | Caption | Left | Top | Width | Height |
|------|------|---------|------|-----|-------|--------|
| Label | `lblTitle` | `3P 2.0  -  PART ENTRY / RUN AUTOMATION` (bold, 12pt) | 12 | 8 | 480 | 20 |
| Label | `lblPartNumber` | `Part Number` | 12 | 38 | 120 | 16 |
| TextBox | `txtPartNumber` | | 140 | 36 | 200 | 18 |
| Label | `lblRevision` | `Revision` | 12 | 62 | 120 | 16 |
| TextBox | `txtRevision` | | 140 | 60 | 60 | 18 |
| Label | `lblCustomer` | `Customer` | 12 | 86 | 120 | 16 |
| TextBox | `txtCustomer` | | 140 | 84 | 240 | 18 |
| Label | `lblRoute` | `Route` | 12 | 110 | 120 | 16 |
| TextBox | `txtRoute` | | 140 | 108 | 240 | 18 |
| Label | `lblValidCodes` | `Valid process codes:` (8pt) | 140 | 128 | 350 | 14 |
| Label | `lblProjectFolder` | `Project Folder` | 12 | 150 | 120 | 16 |
| TextBox | `txtProjectFolder` | | 140 | 148 | 280 | 18 |
| CommandButton | `cmdBrowseFolder` | `...` | 426 | 147 | 60 | 20 |
| Label | `lblTemplate` | `DWG Template` | 12 | 176 | 120 | 16 |
| TextBox | `txtTemplate` | | 140 | 174 | 280 | 18 |
| CommandButton | `cmdBrowseTemplate` | `...` | 426 | 173 | 60 | 20 |
| Label | `lblRouteOK` | `Route OK` | 12 | 204 | 120 | 16 |
| ComboBox | `cboRouteOK` | | 140 | 202 | 70 | 18 |
| Label | `lblPDFOK` | `PDF OK` | 230 | 204 | 80 | 16 |
| ComboBox | `cboPDFOK` | | 320 | 202 | 70 | 18 |
| Label | `lblMailOK` | `Mail OK` | 12 | 230 | 120 | 16 |
| ComboBox | `cboMailOK` | | 140 | 228 | 70 | 18 |
| Label | `lblMailRequired` | `Mail Required` | 230 | 230 | 80 | 16 |
| ComboBox | `cboMailRequired` | | 320 | 228 | 70 | 18 |
| Label | `lblStatus` | *(empty)* | 12 | 262 | 480 | 34 |
| CommandButton | `cmdValidate` | `VALIDATE` (bold) | 12 | 304 | 120 | 28 |
| CommandButton | `cmdRun` | `RUN AUTOMATION` (bold) | 140 | 304 | 160 | 28 |
| CommandButton | `cmdCancel` | `CANCEL` | 308 | 304 | 100 | 28 |

Finally paste the complete code from
[`src/forms/frmAutomation.code.vba`](../src/forms/frmAutomation.code.vba) into
the form's code module (right-click the form → *View Code*).

## What the form does

- **On open** — fills the four YES/NO combo boxes, lists the valid process codes
  from `PROCESS_CONFIG`, pre-fills the project folder and template from
  `USER_CONFIG` / `CONFIG`, and loads the currently selected part if there is one.
- **VALIDATE** — writes the entered values to `MASTER_LIST` (creating the row if
  the part/revision is new), then runs the same validation the buttons use and
  reports the result in the status label.
- **RUN AUTOMATION** — commits the row, hides the form and calls
  `modMain.RunAutomation`, so the state machine handles the rest.
- **…** buttons — Windows folder / file pickers for the project folder and the
  AutoCAD template.
