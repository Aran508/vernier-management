# PED Tool Room — Store & Inventory Management System

Production Engineering Department (PED) Tool Room — a centralized store management
system for issuing tooling/consumables from one store to four production
departments: Machining, Welding, Assembly & Testing, and Burnishing.

## Quick start

The **only** thing you need installed is Node.js 22.5 or newer — get the LTS
build from https://nodejs.org. No compilers, no build tools, no database
server, no browser extensions, nothing else.

Open a terminal in this folder and run:

```bash
npm install
npm run dev
```

Then open http://localhost:3000 and sign in as `admin` / `admin123`.

That's the whole setup. The first run creates everything it needs by itself:

- `data/ped-tool-room.db` — a real SQLite database holding **login accounts
  only, no demo materials or transactions**. You start from a clean slate, and
  the file survives restarts.
- `.env.local` — with a freshly generated random session secret. Nothing to
  fill in by hand.

### Running it for other people on the office network

```bash
npm run host          # development mode, reachable at http://<your-ip>:3000
```

For day-to-day use by the team, build once and run the production server —
it's noticeably faster and doesn't rebuild pages as you browse:

```bash
npm run build
npm run start:host    # http://<your-ip>:3000 for everyone on the network
```

Find `<your-ip>` with `ipconfig` on Windows or `hostname -I` on Linux, and
allow inbound TCP port 3000 through the machine's firewall. `DEPLOYMENT.md`
covers keeping it running permanently.

| Command | What it does |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 (this machine only) |
| `npm run host` | Development server reachable from other PCs on the network |
| `npm run build` | Builds the optimised production version |
| `npm run start` | Runs the production build on http://localhost:3000 |
| `npm run start:host` | Runs the production build for the whole network |
| `npm run lint` | Checks the code for problems |

**Optional — enable email notifications:** open `.env.local` (created for you
on first run) and fill in your SMTP details, see the Email Notifications
section below. Without this the app runs exactly the same, but writes each
email to `data/outbox/` as an HTML file instead of sending it — so nothing
errors out before mail is configured.

### Login accounts (change passwords after first login — see User Management)

| Role | Username | Password | Scope |
|---|---|---|---|
| Store Admin | `admin` | `admin123` | Full access, all departments |
| Process Owner | `machining.po` | `owner123` | Machining |
| Process Owner | `welding.po` | `owner123` | Welding |
| Process Owner | `assembly.po` | `owner123` | Assembly & Testing |
| Process Owner | `burnishing.po` | `owner123` | Burnishing |
| Monitoring | `monitor1` / `monitor2` / `monitor3` | `monitor123` | All departments, read-only |

## Permission model

| Action | Store Admin | Process Owner | Monitoring |
|---|---|---|---|
| View own department (materials, stock, inward, outward) | ✅ | ✅ | ✅ |
| View **all** departments — daily / monthly / overall | ✅ | ❌ (own dept only) | ✅ |
| Create/edit **Inward** entries | ✅ any dept | ✅ own dept only | ❌ read-only |
| Create/edit **Outward** entries | ✅ any dept | ✅ own dept only | ❌ read-only |
| Add / edit / delete Material Master records | ✅ | ❌ | ❌ |
| Create users | ✅ | ❌ | ❌ |
| View Audit Log | ✅ | ❌ | ✅ |

This means: each of the 4 Process Owners can log their own department's full
inward/outward detail (every field from the original spec — date, supplier,
invoice, received by, verified by, issued to, purpose, remarks, etc.), but
only for their own department, and only Store Admin can see/manage every
department's day-to-day and month-to-month totals side by side.

- **PDF Export** — professional PDF reports for Materials, Inward, Outward,
  and Stock Summary, with company letterhead, report title, generated
  date/time, page numbers, and a "current filtered view" vs "entire dataset"
  choice. RBAC-respecting — a Process Owner can never export outside their
  own department. See `src/lib/reportData.ts`, `src/lib/pdf/ReportDocument.tsx`,
  `src/app/api/reports/pdf/route.ts`.
- **Email Notifications** — SMTP-based (via `nodemailer`), configurable
  through `.env.local`. Sends: low-stock/stock-out alerts, material issued
  confirmations, material received confirmations, and new-material admin
  notifications. Safely logs instead of sending if SMTP isn't configured, so
  nothing breaks before you set it up. See `src/lib/mailer.ts` and
  `src/lib/emailTemplates.ts`.

## What's implemented

- **Light, professional enterprise UI** (white/slate theme, not dark)
- **Real persistent database** — SQLite through Node's own built-in
  `node:sqlite` module, file-based at `data/ped-tool-room.db`. Survives server
  restarts, not in-memory, and needs nothing installed beyond Node itself —
  there is no native module to compile, which is why `npm install` works on a
  plain PC with no build tools. See `src/lib/sqliteDriver.ts`.
- Login page with your company logo, remember me, forgot password link
- Dashboard: 12 stat cards, low-stock/excess-stock/no-movement alerts,
  stock-by-department chart, category distribution, top issued materials,
  recent activity — all filterable by department (locked for Process Owners)
- Material Master: search/filter list, **click any row to open a detail view**
  showing every field, with **Edit** and **Delete** actions (Store Admin only;
  other roles see the same detail view read-only)
- Inward module: full-detail entry form (date, supplier, invoice #, part
  number with live lookup/autofill, category, department, quantity, unit,
  received by, verified by, remarks), auto-updates stock, editable after entry
- Outward register: exact columns from the original spec, auto-deducts stock,
  blocks over-issuing, editable after entry
- Stock Summary: opening/inward/outward/closing, location, no-movement days,
  inventory value, status filter chips
- User Management: Store Admin creates Process Owner / Monitoring / Admin users
- Audit Log: every create/edit/delete/login recorded with user, action,
  old/new value, date, time, IP
- Global sticky search (materials, inward, outward) in the topbar
- Role-based route protection via middleware (JWT in httpOnly cookie, verified
  with `jose` so it works correctly on the Edge runtime)

## What's not built yet

- **Excel/CSV export** (PDF export is done; Excel/CSV can reuse the same
  `reportData.ts` builders — noted as a clean next step)
- **Bulk Excel import** — explicitly out of scope for this round, per request
- Barcode/QR generation & scanning — explicitly out of scope for this round
- Monthly-report email (the three transactional email types are wired; a
  scheduled monthly digest would need a cron/scheduler, which isn't set up)
- Dark mode toggle (current build is light-theme only)
- Rate limiting / explicit CSRF tokens (JWT + httpOnly cookies are in place)
- Docker packaging (see `DEPLOYMENT.md` for why, and what adding it would look like)

## Deployment

See **`DEPLOYMENT.md`** for a full guide to hosting this on your office
network (Windows/Linux, PM2, IIS, Nginx, Docker trade-offs, and a production
checklist) so people other than you can access it.

A quick note on *why* it needs a real server rather than typical "serverless"
cloud hosting:

SQLite is a real, persistent, file-based database — perfect for running this
on a normal server or VM (e.g. an internal company server, a VPS, or your own
machine) where the Node process stays alive and `data/` is a persistent disk.

If you later deploy to a **serverless** platform (e.g. Vercel's default
setup), the filesystem is ephemeral between requests and SQLite won't persist
— in that case you'd want to point this at a hosted Postgres/MySQL instead.
The `lib/db.ts` functions are written so that swap is straightforward: each
function is a single, isolated SQL query.

## Project structure

```
src/
  lib/
    types.ts         # Domain types
    sqliteDriver.ts  # Thin SQLite driver over Node's built-in node:sqlite
    sqlite.ts        # DB connection + schema creation + login-account seed
    db.ts            # All data access (materials, inward, outward, users, audit log)
    auth.ts          # JWT sign/verify (jose), RBAC helpers
    reportData.ts    # Shared report row/column builders (used by PDF export)
    mailer.ts        # SMTP wrapper (nodemailer), safe no-op when unconfigured
    emailTemplates.ts # Branded HTML email templates
    pdf/
      ReportDocument.tsx # Reusable @react-pdf/renderer letterhead + table layout
  middleware.ts       # Route protection (runs on every request, Edge runtime)
  app/
    login/            # Public login page
    (app)/             # Authenticated shell (sidebar + topbar)
      dashboard/
      materials/        # includes click-to-view/edit/delete detail modal
      inward/
      outward/
      stock-summary/
      users/
      audit-log/
    api/              # REST API routes, incl. /materials/[id], /inward/[id],
                       # /outward/[id], /reports/pdf
components/
  Sidebar.tsx, Topbar.tsx, StatCard.tsx, Badge.tsx, ExportPdfButton.tsx
public/
  wipro-logo.jpg      # Extracted from the uploaded logo PDF; also used in PDF letterhead
data/
  ped-tool-room.db     # Created on first run — your real data lives here
scripts/
  run.mjs             # Entry point behind every npm script: checks the Node
                      # version, creates data/ and .env.local on first run
DEPLOYMENT.md          # Office-network hosting guide (Windows/Linux/IIS/Docker)
```

## Backing up your data

Your data is the single file `data/ped-tool-room.db` (plus its `-wal`/`-shm`
companion files while the server is running). To back up: stop the server,
copy that file somewhere safe.
