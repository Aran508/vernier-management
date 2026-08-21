# 3P 2.0 — Test plan

The workbook builder creates the sample part required by the acceptance test.

## Sample data (topic 110)

| Field | Value |
|-------|-------|
| Part Number | `PN-10025` |
| Revision | `A` |
| Customer | `TEST CUSTOMER` |
| Route | `CT-FC-CH-ET-WD` |
| Route OK | `YES` |
| PDF OK | `NO` |
| Mail OK | `NO` |
| Mail Required | `YES` |

## T1 — First run

**Do:** select `PN-10025`, press **RUN AUTOMATION**.

**Expect:**

| Column | Value |
|--------|-------|
| Folder Status | `Created` |
| Excel Status | `Created` |
| DWG Status | `Created` |
| PDF Status | `Waiting` |
| Mail Status | `Waiting` *(or `Not Started` until the mail gate is reached)* |
| Automation Status | `Waiting` |

**Also check on disk:**

```
D:\3P Projects\PN-10025\
    DWG\PN-10025.dwg
    Excel\PN-10025.xlsx     (sheets CT, FC, CH, ET, WD in that order)
    PDF\                    (empty)
```

The progress box on `CONTROL_PANEL` shows the first four steps ticked and
`CURRENT STEP: Waiting for PDF OK = YES`.

## T2 — Idempotence (topics 47, 62)

**Do:** press **RUN AUTOMATION** four more times.

**Expect:** identical statuses, no `PN-10025 (1).xlsx`, no second drawing, no
extra folders, no new files anywhere. The `AUTOMATION_LOG` shows the repeated
runs, each stopping at the PDF gate.

## T3 — Engineer editing (topics 25, 88)

**Do:** press **OPEN DWG**, change something, save and close in AutoCAD, then
press **MARK DWG AS EDITED**.

**Expect:** `DWG Status = Edited`, `DWG Edited Date` stamped. Pressing **RUN
AUTOMATION** does **not** rebuild the drawing.

## T4 — PDF (topics 27, 111)

**Do:** set `PDF OK = YES`, press **RUN AUTOMATION**.

**Expect:** `PDF Status = Created`, `PDF File Path` and `PDF Created Date`
filled, `D:\3P Projects\PN-10025\PDF\PN-10025.pdf` exists and is larger than
zero bytes. Automation stops at the mail gate.

## T5 — Mail preparation (topics 40, 111, 118, 119)

**Do:** set `Mail OK = YES`, press **SEND PDF**.

**Expect:**

- `Mail To` = the five owner addresses from `PROCESS_OWNER_CONFIG`, separated by
  `; `, with duplicates removed;
- `Mail Subject` = `3P Process Drawing Release - PN-10025 - Rev A`;
- an Outlook draft opens with the body filled in and `PN-10025.pdf` attached —
  **without any file browser appearing**;
- `Mail Status = Ready`, **not** `Sent`.

## T6 — Sending (topics 42, 82)

**Do:** send the message in Outlook, then press **MARK MAIL AS SENT**.

**Expect:** the message is found in *Sent Items*, `Mail Status = Sent`,
`Mail Sent Date` / `Mail Sent By` filled, `Automation Status = Complete`,
`Release Date` stamped.

## T7 — Cancelled draft (topics 43, 86)

**Do:** press **SEND PDF** again (confirm the resend), close the draft without
sending, press **MAIL NOT SENT**.

**Expect:** `Mail Status` stays `Ready`,
`Mail Error = Email draft closed before sending`. **SEND PDF** can be pressed
again.

## T8 — Resend protection (topics 44, 85)

**Do:** with `Mail Status = Sent`, press **SEND PDF**.

**Expect:** a dialog showing the part number, sent date and recipients, asking
whether to resend. Answering *No* changes nothing. Answering *Yes* prefixes the
subject with `[RESEND]` and logs a separate entry.

## T9 — Change detection (topics 103, 104)

**Do:** press **MARK DWG AS EDITED** on the completed part.

**Expect:** `PDF OK` returns to `NO` and `PDF Status` to `Waiting`. Produce a new
PDF: `Mail OK` returns to `NO` and `Mail Status` to `Waiting`. The old PDF can no
longer be released as current.

## T10 — Mail not required (topic 29)

**Do:** add a part with `Mail Required = NO` and run it through to the PDF.

**Expect:** `Mail Status = Skipped`, `Automation Status = Complete` without any
Outlook interaction.

## Error tests (topic 112)

| # | Set up | Expected message and state |
|---|--------|----------------------------|
| E1 | Route `CT-FC-ABC-WD` | `ROUTE VALIDATION FAILED … Invalid process code: ABC … Valid process codes: CT FC CH ET WD`. Nothing created |
| E2 | Route `CT-FC-CT` with `Allow Duplicate Process Codes = NO` | `Duplicate process code: CT` |
| E3 | Project Folder `Z:\nowhere` | `Project Folder does not exist on this computer` |
| E4 | Project Folder on a read-only share | `Project Folder is not writable (permission denied)` |
| E5 | DWG Template renamed away | `AutoCAD template not found`, `DWG Status = Error` |
| E6 | Rename `BLK_CH` in the template | `Process block BLK_CH not found in AutoCAD template.` `DWG Status = Error`, workflow stops |
| E7 | Close AutoCAD and block it from starting | `AutoCAD is not available` |
| E8 | Make the DWG folder read-only | `DWG save failed` |
| E9 | `PDF Plot Configuration = Nonexistent.pc3` | `PDF creation failed … Check the 'PDF Plot Configuration' entry in CONFIG` |
| E10 | Delete the PDF, then press **SEND PDF** | `Mail Status = Error`, `Mail Error = PDF file not found` |
| E11 | Close Outlook and block it from starting | `Outlook is not available …` |
| E12 | `PROCESS_OWNER_CONFIG` address `ct.owner@` | `Invalid e-mail address in PROCESS_OWNER_CONFIG` |
| E13 | Clear all owner e-mail addresses | `No process owner e-mail addresses could be found for route …` |
| E14 | `Approval Status = Rejected` | `Document approval is rejected. Automation cannot continue.` |
| E15 | Part Number `PN/10025` | `Part Number contains characters Windows does not allow …` with a suggested name |
| E16 | Two rows with the same part number, no revision selected | `Part Number 'PN-10025' exists 2 times … Specify the Revision` |
| E17 | Nothing selected, press **RUN AUTOMATION** | `Please select a Part Number before running automation.` |

Every one of these also appears in `AUTOMATION_LOG` with `Result = FAILED` and
the exact message, and in `MASTER_LIST` as `Error Status = ERROR` plus
`Error Message`.

## Multi-part test (topic 93)

Add 20 parts with different routes and project folders and run them in any
order. Each part must keep its own folders, files, statuses, recipients and log
entries; no part may overwrite another's data. `CONTROL_PANEL` KPI cards must
total correctly (`TOTAL PARTS` = 20).
