# 3P 2.0 — Workflow, states and statuses

## Daily workflow

| # | Operator action | System reaction |
|---|-----------------|-----------------|
| 1 | **NEW PART** — enter part number, revision, customer, route, project folder, template | Row added to `MASTER_LIST`, all statuses `Not Started` |
| 2 | **VALIDATE ROUTE** | Fields and every process code checked against `PROCESS_CONFIG` |
| 3 | Set `Route OK = YES` in `MASTER_LIST` | The gate opens |
| 4 | **RUN AUTOMATION** | Folders → process Excel → AutoCAD drawing, then stops at the PDF gate |
| 5 | Engineer edits the drawing (optional), then **MARK DWG AS EDITED** | `DWG Status = Edited`, `DWG Edited Date` stamped; any existing PDF is invalidated |
| 6 | Set `PDF OK = YES`, press **RUN AUTOMATION** (or **CONVERT TO PDF**) | The latest saved DWG is plotted, the PDF verified on disk |
| 7 | Set `Mail OK = YES`, press **SEND PDF** | Recipients built from the route, PDF located and attached, Outlook draft displayed |
| 8 | Send the message in Outlook, then **MARK MAIL AS SENT** | The message is looked up in *Sent Items*; only then `Mail Status = Sent` |
| 9 | — | `Automation Status = Complete`, `Release Date` stamped, everything logged |

## The state machine

`RunAutomation` derives the state from `MASTER_LIST` alone and continues from
the first incomplete stage.

| State | Name | Continues with |
|-------|------|----------------|
| 0 | Not started / waiting for `Route OK` | nothing until `Route OK = YES` |
| 1 | Route validated | create folders |
| 2 | Folder created | create process Excel |
| 3 | Excel created | create the drawing |
| 4 | DWG created | convert to PDF (`PDF OK = YES`) |
| 5 | Waiting for engineer editing / PDF approval | operator action |
| 6 | DWG edited | convert to PDF |
| 7 | Waiting for PDF approval | operator sets `PDF OK = YES` |
| 8 | PDF created | prepare the e-mail (`Mail OK = YES`) |
| 9 | Waiting for mail approval | operator sets `Mail OK = YES` |
| 10 | Mail ready | operator sends it, then **MARK MAIL AS SENT** |
| 11 | Mail sent | final status |
| 12 | Complete | — |
| ERROR | Error | operator fixes the cause, then re-runs |

### Restart behaviour

| Current statuses | `RUN AUTOMATION` starts at |
|------------------|----------------------------|
| Folder/Excel/DWG `Created`, PDF `Not Started`, `PDF OK = YES` | the PDF stage |
| DWG `Edited`, PDF `Created`, Mail `Waiting`, `Mail OK = NO` | stops at the mail gate |
| PDF `Created`, `Mail OK = YES`, Mail `Ready` | does **not** regenerate the PDF, does **not** resend — it reports that the draft is waiting to be sent |
| Everything `Created` and Mail `Sent` | final status only |

Nothing is created twice: existing folders are reused, an existing
`<Part Number>.xlsx` is verified and updated in place, an existing drawing is
reused unless **REGENERATE DWG** is pressed, and an up-to-date PDF is reused.

## Status values

| Column | Values |
|--------|--------|
| `Folder Status` | `Not Started` / `Created` / `Error` |
| `Excel Status` | `Not Started` / `Created` / `Error` |
| `DWG Status` | `Not Started` / `Created` / `Edited` / `Error` |
| `PDF Status` | `Not Started` / `Waiting` / `Created` / `Error` |
| `Mail Status` | `Not Started` / `Waiting` / `Ready` / `Sent` / `Skipped` / `Error` |
| `Automation Status` | `Not Started` / `Waiting` / `Running` / `Complete` / `Error` |

**`Ready` is not `Sent`.** In `DISPLAY` mode the system prepares and shows the
message and stops at `Ready`. `Sent` is written only when

- `SEND` mode and Outlook's `Send` succeeded, or
- **MARK MAIL AS SENT** found the message in Outlook's *Sent Items* (or the
  operator explicitly confirmed it when it could not be found).

Closing the draft without sending leaves `Mail Status = Ready`; **MAIL NOT SENT**
records `Mail Error = Email draft closed before sending`.

## Change detection

| Trigger | Effect |
|---------|--------|
| `DWG Edited Date` > `PDF Created Date` | `PDF OK` → `NO`, `PDF Status` → `Waiting` |
| A new PDF is plotted while mail was `Ready` or `Sent` | `Mail OK` → `NO`, `Mail Status` → `Waiting` |
| `PDF Created Date` > `Mail Sent Date` | `Mail OK` → `NO`, `Mail Status` → `Waiting` |

A superseded PDF can therefore never be released as if it were the current one.

## Completion rules

```
Folder = Created
Excel  = Created
DWG    = Created OR Edited
PDF    = Created
Mail   = Sent          (or Skipped when Mail Required = NO)
    →  Automation Status = Complete, Release Date stamped once
```

## Resend protection

Pressing **SEND PDF** on a part whose `Mail Status = Sent` shows the part
number, the sent date and the recipients and asks for confirmation. A confirmed
resend is prefixed `[RESEND]` in the subject and logged as a separate action.
`RUN AUTOMATION` never resends by itself.

## Reset, regenerate, backup

| Button | Behaviour |
|--------|-----------|
| **RESET / REPROCESS** | Asks for confirmation, offers a backup, then clears statuses only. **No file is deleted.** Existing files are reused on the next run |
| **REGENERATE DWG** | Backs the current drawing up to `<Part>\Backup\<Part>_yyyymmdd_hhnnss.dwg`, then rebuilds it from the template |
| **REGENERATE PDF** | Backs the current PDF up the same way, then re-plots from the latest saved DWG |

## Error handling

Every stage traps its errors and writes:

- `Error Status = ERROR`, `Error Message = <the real message>`,
- the failing stage's status = `Error`, `Automation Status = Error`,
- `Last Action`, `Last Updated`,
- a row in `AUTOMATION_LOG` with the action, the result and the message.

Typical messages: *AutoCAD template not found*, *Process block BLK_CH not found
in AutoCAD template*, *AutoCAD is not available*, *DWG save failed*, *PDF
creation failed*, *PDF file not found*, *Outlook is not available*, *Invalid
e-mail address in PROCESS_OWNER_CONFIG*, *Attachment failed*.
