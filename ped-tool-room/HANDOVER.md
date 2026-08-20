# PED Tool Room — Handover

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The database is created automatically at
`data/ped-tool-room.db` on first run, seeded with login accounts only.

| Role | Username | Password |
|---|---|---|
| Store Admin | `admin` | `admin123` |
| Process Owner | `machining.po` / `welding.po` / `assembly.po` / `burnishing.po` | `owner123` |
| Monitoring | `monitor1` / `monitor2` / `monitor3` | `monitor123` |

**Change these after first login** (Profile → Change Password).

## What is NOT in this archive, and why

- **`data/`** — the database holds your material records, bcrypt password
  hashes and the saved SMTP password. Excluded so credentials aren't shipped
  in a zip. Copy `data/ped-tool-room.db` across manually if you're moving an
  existing install.
- **`.env.local`** — contains `SMTP_PASS`. Use `.env.example` as the template.
- `node_modules/`, `.next/` — reinstall/rebuild with `npm install`.

## Email setup

Settings (gear icon, Store Admin only) → **Outgoing Email**. Pick the preset
that matches the address you're sending *from*:

| Sending address | Host | Port |
|---|---|---|
| Microsoft 365 work mailbox | `smtp.office365.com` | 587 |
| Personal outlook.com / hotmail | `smtp-mail.outlook.com` | 587 |
| Gmail | `smtp.gmail.com` | 587 |

**The Password field needs an App Password, not your normal account
password.** Gmail and personal Microsoft accounts both reject ordinary
passwords over SMTP. Generate one at
https://myaccount.google.com/apppasswords (Gmail — two-step verification must
be on first).

Known blocker on the Wipro work account: the tenant has SMTP AUTH disabled
(`535 5.7.139`). No setting in this app can override that — IT has to enable
SMTP AUTH for the mailbox, or provide an internal relay host.

**Email works without SMTP.** With nothing configured, every notification is
written to `data/outbox/` as an openable `.html` file, and failed sends are
preserved there too, so nothing is silently lost. Settings → **View recent
mail** shows the last 25 attempts with status and reason.

## Things worth knowing

- **Imported data is incomplete.** The current material records have blank
  `department` and `category` values, because the source sheet didn't carry
  those columns. Consequences: department filters can't narrow, the category
  chart shows one "Uncategorised" slice, and editing a material fails
  validation until a department is set. Re-import with `Department` and
  `Category` columns filled, or set them per record.
- **Clear All** (Settings) deletes one module at a time and writes a full
  database backup to `data/backups/` first. Requires typing the module name.
- Duplicate notifications are suppressed per item per day, so a low-stock
  alert fires once rather than on every issue.
