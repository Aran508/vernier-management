# 3P 2.0 — Configuration

Nothing in this list is hard-coded in VBA. Everything below is read at run time
from a worksheet.

## CONFIG sheet (`tblConfig`)

| Setting | Default | Meaning |
|---------|---------|---------|
| `Project Root Folder` | `D:\3P Projects` | Used when `MASTER_LIST → Project Folder` is blank |
| `Default DWG Template` | `D:\3P Templates\3P_Template.dwg` | Used when `MASTER_LIST → DWG Template` is blank |
| `AutoCAD Application` | `AutoCAD.Application` | COM ProgID. Use `AutoCAD.Application.25` to pin a release |
| `PDF Plot Configuration` | `DWG To PDF.pc3` | Plot device for DWG → PDF |
| `PDF Paper Size` | *(blank)* | Optional canonical media name, e.g. `ISO_full_bleed_A3_(420.00_x_297.00_MM)` |
| `PDF Plot Style` | `monochrome.ctb` | Optional CTB/STB; blank keeps the layout setting |
| `Company Name` | `COMPANY NAME` | Printed on process sheets, title block, control panel |
| `Department Name` | `Production Engineering Department` | E-mail signature |
| `System Version` | `2.0.0` | Shown on the control panel and generated documents |
| `Default Block Scale` | `1` | Fallback when `PROCESS_CONFIG` scale is blank |
| `Default Process Spacing` | `150` | Horizontal spacing when a process has no `X Position` |
| `Email Send Mode` | **`DISPLAY`** | `DISPLAY` = build and show for review; `SEND` = send automatically |
| `Email Distribution Mode` | `ALL_ROUTE_OWNERS` | `ALL_ROUTE_OWNERS`, `CURRENT_PROCESS_OWNER` (first route step only), `CUSTOM` (use the `Mail To` column as typed) |
| `Email Subject Template` | `3P Process Drawing Release - {PART_NUMBER} - Rev {REVISION}` | Tokens below |
| `Email Body Template` | *(full engineering body)* | Tokens below; `\n` in the cell becomes a line break |
| `Mail Required Default` | `YES` | Default for a new part |
| `Allow Duplicate Process Codes` | `NO` | `YES` permits e.g. `CT-FC-CT` |
| `DWG Table Mode` | `TABLE` | `TABLE` = an AutoCAD table per process built from its Excel sheet; `NONE` = blocks only |
| `DWG Table Y Offset` | `40` | Drawing units below the block where its table sits |
| `DWG Table Row Height` | `8` | AutoCAD table row height |
| `DWG Table Column Width` | `30` | AutoCAD table base column width |
| `DWG Table Text Height` | `2.5` | Used by the MText fallback |
| `Backup Before Regenerate` | `YES` | Copy the current DWG/PDF into `Backup\` before replacing |
| `AutoCAD Visible` | `YES` | Show the AutoCAD window while working |
| `AutoCAD Ready Timeout Sec` | `120` | Bounded wait for AutoCAD |
| `PDF Plot Timeout Sec` | `120` | Bounded wait for the PDF to appear |
| `Close DWG After Create` | `NO` | Close the drawing in AutoCAD when finished |
| `Date Display Format` | `dd-mmm-yyyy` | Used in messages and e-mails |

### Template tokens

Usable in `Email Subject Template` and `Email Body Template`:

```
{PART_NUMBER} {REVISION} {CUSTOMER} {ROUTE} {RELEASE_DATE} {DATE}
{USER_NAME} {EMPLOYEE_ID} {DEPARTMENT} {COMPANY} {APPROVED_BY}
{PDF_NAME} {PDF_PATH} {OTHER_DETAILS}
```

## PROCESS_CONFIG sheet (`tblProcess`)

One row per process code. Add a row to introduce a new process — no code change.

| Column | Example | Notes |
|--------|---------|-------|
| `Process Code` | `CT` | Used in the route, uppercase |
| `Process Name` | `Cutting` | Shown on the process sheet and in mail messages |
| `Block Name` | `BLK_CT` | Must exist in the AutoCAD template |
| `Excel Sheet Name` | `CT` | Sheet created in `<Part Number>.xlsx` |
| `Enabled` | `YES` | `NO` makes the code invalid in a route |
| `X Position`, `Y Position` | `100`, `100` | Block insertion point (drawing units) |
| `Scale X`, `Scale Y` | `1`, `1` | Block scale |
| `Rotation` | `0` | Degrees; converted to radians internally |
| `Description` | free text | Copied into the process sheet and the DWG table |
| `Owner` | `Cutting Owner` | Display name; the address lives in `PROCESS_OWNER_CONFIG` |

## PROCESS_OWNER_CONFIG sheet (`tblOwner`)

| Column | Example |
|--------|---------|
| `Process Code` | `CT` |
| `Process Name` | `Cutting` |
| `Process Owner` | `CT Owner` |
| `Email` | `ct.owner@company.com` |
| `CC Email` | *(optional)* |
| `Enabled` | `YES` |

- Replace the `@company.com` examples with real Outlook addresses.
- A cell may hold several addresses separated by `;` or `,`.
- Duplicate addresses are removed; an address in **To** is never repeated in
  **CC**.
- A route step whose owner is missing, disabled or has no address is reported to
  the operator before the message is created.

## USER_CONFIG sheet (`tblUser`)

| Setting | Notes |
|---------|-------|
| `User Name` | Prepared By, e-mail signature. Defaults to the Windows account |
| `Employee ID` | `{EMPLOYEE_ID}` token |
| `Department` | Overrides `CONFIG → Department Name` for this workstation |
| `Role` | Informational |
| `Computer Name` | Filled in automatically on open |
| `Last Login` | Filled in automatically on open |
| `Default Project Folder` | Offered when adding a new part |
| `Enabled` | Informational flag for the workstation |

## Per-part overrides in MASTER_LIST

| Column | Effect |
|--------|--------|
| `Project Folder` | Overrides `CONFIG → Project Root Folder` |
| `DWG Template` | Overrides `CONFIG → Default DWG Template` |
| `DWG Folder`, `Excel Folder`, `PDF Folder` | Sub-folder names (default `DWG`, `Excel`, `PDF`) |
| `Route OK`, `PDF OK`, `Mail OK`, `Mail Required` | The four approval gates |
| `Approval Status` | `Pending` / `Approved` / `Rejected` — `Rejected` stops the automation |

## Configuration checklist before first production use

1. `CONFIG → Project Root Folder` — exists and is writable.
2. `CONFIG → Default DWG Template` — exists and holds every configured block.
3. `CONFIG → PDF Plot Configuration` — a plot device AutoCAD actually offers.
4. `CONFIG → Company Name` / `Department Name`.
5. `CONFIG → Email Send Mode` — leave `DISPLAY` until the templates are approved.
6. `PROCESS_CONFIG` — block names and positions match the template.
7. `PROCESS_OWNER_CONFIG` — real addresses, `Enabled = YES`.
8. `USER_CONFIG` — user name and department.
9. Run `CheckSetup` and `CheckTemplateBlocks`.
