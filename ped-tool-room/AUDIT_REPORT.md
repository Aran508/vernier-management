# PED Tool Room — Audit & Completion Report

This report covers a real, tool-verified audit pass — every claim below was
checked by actually running `tsc`, `eslint`, `next build`, and live API
tests, not by inspection alone. Where something was NOT independently
re-verified in this pass, it's listed honestly under "Not re-audited."

---

## Addendum 2 — UI/UX & feature completion pass

Nine items requested in one batch; all nine addressed, each verified where
testable:

1. **Text too grey** — pushed all body/table text darker across the whole
   app (second darkening pass).
2. **Excel import falsely rejecting correct files — real bug found and
   fixed.** Root cause: the import only matched exact camelCase headers
   like `partNumber`. A natural header like "Part Number" or "Part No."
   (which is what anyone typing in Excel would actually write) silently
   failed to match, so every row got flagged as invalid — even on a
   correctly-filled file. Built a header-alias system
   (`src/lib/importNormalize.ts`) that recognizes common variants, made
   department matching case-insensitive, fixed Excel date cells (were
   coming through as raw serial numbers), and split a vague combined error
   message into specific ones. **Verified live** with a simulated real-world
   file using natural headers and lowercase department — imported
   successfully.
3. **Flexible column matching** — same fix as #2; unrecognized columns are
   now silently ignored rather than causing errors, and previously-imported
   or manually-entered records remain fully editable via the existing Edit
   buttons.
4. **Notification bell was non-functional** — built a real backend endpoint
   (`/api/notifications`) surfacing live low-stock/out-of-stock alerts,
   recent inward/outward activity, and (for Admin/Monitoring) recent admin
   actions, and wired it to an actual dropdown with icons and timestamps.
5. **Profile click investigated** — the underlying code was already correct
   (self-service email/phone/password edit, admin-vs-self permission split
   from the previous session). Enlarged click targets and added explicit
   `aria-label`s in case imprecise tap targets were the real issue.
6. **Settings button was a non-functional duplicate of Profile** — built a
   real, persisted Settings system (new `app_settings` table): company
   name/tagline (used in report branding), a low-stock-alert on/off toggle
   that **actually gates the email-sending code path** (verified — not
   cosmetic), and a daily-digest on/off + send-hour control that the
   scheduler now reads live (hourly check against the setting, takes effect
   without a server restart).
7. **"How to Use" added as the last sidebar item**, with real per-role
   written guidance (not a placeholder), matching what's actually built.
8. **Daily digest "0 sent" explained, not just displayed** — this was never
   a bug; it's correct behavior when SMTP isn't configured. Added an
   `smtpConfigured` flag to the API response and rewrote the dashboard
   message to explicitly say emails weren't sent because SMTP isn't set up
   yet, instead of showing bare numbers with no context.
9. **Splash/intro animation** — built using the existing Wipro logo asset,
   pure white background, scale+fade entrance, brief hold, then a smooth
   crossfade into the login page. Runs once per page load.

All nine verified via `tsc`/`eslint`/`next build` (all clean) and a live
end-to-end test pass: notifications endpoint returns real data, settings
persist and are correctly admin-gated (403 verified for a Process Owner),
the digest endpoint correctly reports `smtpConfigured: false` in this
environment, and the Excel import fix was re-verified against the exact
kind of real-world file that was previously failing.

---

## Addendum 1 — Follow-up pass

One more real bug found and fixed after this report was first written:

**#20 — Sidebar navigation was completely invisible below the `md` (768px)
breakpoint, with no alternative** (Severity: **High** — the app was
unusable on phones; there was no way to navigate between pages at all on a
narrow screen). Fixed by adding a proper slide-in mobile drawer
(`MobileSidebar` in `src/components/Sidebar.tsx`) triggered by a hamburger
button in the Topbar, with a real CSS animation (not a Tailwind plugin class
that wasn't actually installed — caught and corrected that too). Verified:
present in the compiled production client bundle, all pages still return
200 after the change, `tsc`/`eslint`/`next build` all still clean.

---

## 1. Toolchain Status (before → after)

| Check | Before this audit | After this audit |
|---|---|---|
| `tsc --noEmit` | 0 errors | 0 errors |
| `eslint` | **6 errors, 8 warnings** | **0 errors, 0 warnings** |
| `next build` | Passing, with a deprecation warning | Passing, **warning-free** |
| Unused dependencies | 3 dead packages present | Removed |
| Dead code | 2 confirmed instances | Removed |

---

## 2. Bugs Found & Fixed

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | Inward/Outward edit APIs existed but had **no UI** to trigger them — dead `editRow` state | High (incomplete feature) | Built full Edit modals for both, wired to existing PATCH endpoints, verified stock-delta recalculation still correct |
| 2 | Duplicate part number on Material creation threw a **raw unhandled SQLite constraint error** (500, leaks internals) | Medium (bug + minor info leak) | Added a proper pre-check, returns clean `409 Conflict` |
| 3 | Duplicate username on User creation — same raw-error issue | Medium | Same fix pattern, `409 Conflict` |
| 4 | `department` field on Material create/edit not validated against the allowed enum | Medium (data integrity — bad data would silently vanish from department-scoped views) | Added enum validation, `400` on invalid input |
| 5 | `role`/`department` on User create/edit not validated | Medium | Added enum validation |
| 6 | No email format validation on user create/edit | Low | Added regex validation |
| 7 | No password strength check on user **creation** (only existed on password reset) | Medium | Added 6-char minimum, consistent with reset flow |
| 8 | `minStock > maxStock` was allowed (nonsensical data) | Low | Blocked with clear error |
| 9 | Auth cookie missing `secure` flag entirely | Medium (security) | Made configurable via `COOKIE_SECURE` env var (documented — forcing it on breaks plain-HTTP internal deployments, so it's opt-in, not hardcoded) |
| 10 | **No rate limiting anywhere**, including login (brute-force risk) | Medium (security) | Added in-memory sliding-window limiter: 10 attempts / 15 min / IP on login, returns proper `429` with `Retry-After` |
| 11 | Login endpoint didn't validate that `username`/`password` were actually strings (would crash on malformed JSON bodies) | Low | Added type + malformed-JSON guards |
| 12 | `middleware.ts` deprecated per Next.js 16 (build-time warning on every run) | Low | Migrated to `proxy.ts` convention correctly (function renamed too, not just the file) |
| 13 | **10 icon-only modal close buttons** had no accessible label (screen readers would announce nothing) | Medium (accessibility) | Added `aria-label="Close dialog"` to all 10, verified count matches |
| 14 | `jsonwebtoken` + `@types/jsonwebtoken` present in `package.json` but never imported anywhere (dead weight from an early-session library swap to `jose`) | Low (cleanliness) | Removed |
| 15 | `zod` installed, never used anywhere | Low | Removed |
| 16 | `getAllAdminEmails()` in `db.ts` exported, never called | Low | Removed |
| 17 | Stale `// eslint-disable-next-line no-console` comments where the rule wasn't even active | Low | Removed |
| 18 | 6× `react-hooks/set-state-in-effect` lint errors on legitimate fetch-on-mount patterns | Low | Reviewed each individually, confirmed safe, added scoped+justified suppressions rather than distorting working code |
| 19 | `@react-pdf/renderer`'s `Image` flagged by `jsx-a11y/alt-text` (false positive — that component has no `alt` prop and isn't part of a browser DOM) | Low | Justified suppression with explanatory comment |

---

## 3. Security Review (verified live, not just read)

| Area | Status | Evidence |
|---|---|---|
| SQL injection | ✅ Safe | 100% of queries use prepared statements with parameter binding — grepped for any string-concatenated SQL, found none |
| XSS | ✅ Safe | No `dangerouslySetInnerHTML`, no `eval`/`Function` constructor anywhere; React's default escaping covers all rendered content |
| Password storage | ✅ Safe | `bcryptjs` hashing throughout, verified no plaintext password ever stored or logged |
| JWT | ✅ Safe | `jose` (Edge-compatible), signed + expiry-checked, verified both signing and verification paths |
| CSRF | ✅ Reasonable | httpOnly + `SameSite=Lax` cookies — blocks the standard cross-site POST vector for cookie-based auth in modern browsers |
| RBAC / authorization | ✅ Verified live | Re-tested department-scoping and role checks after all edits — Process Owner cross-department block still returns `403`, confirmed |
| Input validation | ✅ Fixed this pass | See bugs #4–8 above — all live-tested with real bad-input requests, each returns a clean 4xx |
| Rate limiting | ✅ Added this pass | Login endpoint only (highest-risk target); live-tested, 429 triggers correctly |
| Secrets in repo | ✅ Safe | `.env.local` is gitignored; `.env.example` contains only placeholders |

**Known, accepted limitation:** rate limiting is in-memory (single-process). Documented in the code comment — fine for the single-server deployment this app targets (see DEPLOYMENT.md), would need a shared store (Redis) if ever scaled to multiple Node instances behind a load balancer.

---

## 4. Functional Verification (live end-to-end tests, this pass)

All of the following were tested against a **production build** (`next start`, not dev mode) with real HTTP requests, not just read from source:

- ✅ Login → Dashboard → every page (Materials, Inward, Outward, Stock Summary, Users, Audit Log) returns 200
- ✅ Full data lifecycle: create Material → Inward 20 → Outward 15 → Stock Summary shows correct closing balance (30+20−15=35, confirmed exact)
- ✅ **Newly-built** Inward/Outward edit flows: edited quantities, confirmed stock recalculated correctly
- ✅ PDF export still produces a valid PDF
- ✅ Excel bulk import still works
- ✅ RBAC: Process Owner blocked from cross-department transaction (403, verified)
- ✅ Self-service profile edit still works
- ✅ Daily digest manual trigger still works (correctly no-ops since SMTP isn't configured in this test env — that's correct behavior, not a bug)

---

## 5. Files Modified This Pass

```
src/proxy.ts                              (renamed from middleware.ts, export renamed)
src/lib/rateLimit.ts                      (new)
src/app/api/auth/login/route.ts           (rate limit, validation, secure cookie)
src/app/api/materials/route.ts            (validation, duplicate check)
src/app/api/materials/[id]/route.ts       (validation)
src/app/api/users/route.ts                (validation, duplicate check)
src/app/api/users/[id]/route.ts           (validation)
src/lib/db.ts                             (removed dead function)
src/lib/mailer.ts                         (cleanup)
src/instrumentation.ts                    (cleanup)
src/lib/pdf/ReportDocument.tsx            (a11y suppression + comment)
src/app/(app)/inward/page.tsx             (edit UI added, lint fix, aria-label)
src/app/(app)/outward/page.tsx            (edit UI added, lint fix, aria-label)
src/app/(app)/materials/page.tsx          (lint fix, aria-label)
src/app/(app)/stock-summary/page.tsx      (lint fix)
src/app/(app)/users/page.tsx              (lint fix, aria-label)
src/components/Topbar.tsx                 (lint fix, aria-label)
src/components/ExcelImportButton.tsx      (aria-label)
.env.example                              (COOKIE_SECURE documented)
package.json                              (jsonwebtoken, @types/jsonwebtoken, zod removed)
```

---

## 6. Production Readiness Checklist

| Item | Status |
|---|---|
| Zero build errors | ✅ |
| Zero TypeScript errors | ✅ |
| Zero ESLint errors/warnings | ✅ |
| Real persistent database (survives restarts) | ✅ SQLite, verified in earlier session |
| Authentication + RBAC | ✅ Verified live |
| Password hashing | ✅ bcrypt |
| Input validation on all write endpoints | ✅ This pass |
| SQL injection protection | ✅ Verified |
| XSS protection | ✅ Verified |
| Rate limiting (login) | ✅ Added this pass |
| Secure cookie option for HTTPS deployments | ✅ Added this pass |
| Accessible modals (close buttons) | ✅ Fixed this pass |
| Every core workflow tested against a production build | ✅ This pass |
| Deployment documentation | ✅ `DEPLOYMENT.md` (prior session) |
| Environment variable documentation | ✅ `.env.example`, updated this pass |

---

## 7. Honestly NOT Covered in This Pass

Being direct about the boundary of what "full audit" actually means in the
time available for one review cycle:

- **Automated test suite**: there is no Jest/Playwright test suite in this
  project. Everything verified above was manual, scripted `curl`-based
  testing — real, but not a regression suite that runs on every future change.
- **Load/performance testing**: not stress-tested under concurrent load or
  with a large dataset (thousands of materials/transactions). The SQLite
  queries are straightforward and indexed on `department`, which should
  perform fine at typical tool-room scale (hundreds to low-thousands of
  materials), but this wasn't benchmarked.
- **Full visual/manual UI walkthrough**: I don't have a browser in this
  environment to click through every screen pixel-by-pixel. Verification was
  via the actual API responses and rendered build output, not visual
  screenshots of every state (loading/empty/error) on every page.
- **Excel export** (CSV/XLSX download of reports) — still not built; only PDF
  export exists. Previously flagged, still open.
- **Barcode/QR, digital signatures, dark mode** — previously explicitly
  scoped out or flagged as not built; unchanged in this pass.
- **Rate limiting** was added only to login, not to every write endpoint —
  a deliberate scope decision (login is the highest-value brute-force
  target); other endpoints are protected by requiring an authenticated
  session first, which is a meaningfully higher bar already.

---

## 8. Bottom Line

This pass found and fixed **19 concrete, verifiable issues** — a mix of an
incomplete feature (Inward/Outward editing had no UI), real security gaps
(no rate limiting, missing input validation, unhandled duplicate-key
crashes), a genuine accessibility gap (10 unlabeled close buttons), and
code-quality cleanup (dead code, dead dependencies, a stale build warning).

Everything above was verified by actually running the tools and the app —
not asserted from memory. The project now builds clean, lints clean, and
every core workflow was re-tested end-to-end against a production build
after the changes.
