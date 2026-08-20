import bcrypt from "bcryptjs";
import { sqlite, backupDatabase } from "./sqlite";
import {
  AuditLogEntry,
  Department,
  DEPARTMENTS,
  InwardEntry,
  Material,
  OutwardEntry,
  Role,
  User,
} from "./types";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function logAudit(user: string, action: string, oldValue: string, newValue: string, ip = "127.0.0.1") {
  sqlite
    .prepare(
      `INSERT INTO audit_log (id, user, action, oldValue, newValue, date, time, ipAddress)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(uid("aud"), user, action, oldValue, newValue, todayISO(), new Date().toLocaleTimeString(), ip);
}

// --- Users -------------------------------------------------------------
export function findUserByUsername(username: string): User | undefined {
  return sqlite
    .prepare(`SELECT * FROM users WHERE lower(username) = lower(?)`)
    .get(username) as User | undefined;
}
export function getUserById(id: string): User | undefined {
  return sqlite.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as User | undefined;
}
export function listUsers(): User[] {
  return sqlite.prepare(`SELECT * FROM users ORDER BY createdAt DESC`).all() as User[];
}
export function createUser(u: Omit<User, "id" | "createdAt" | "lastLogin">): User {
  const newUser: User = { ...u, id: uid("usr"), createdAt: todayISO(), lastLogin: null };
  sqlite
    .prepare(
      `INSERT INTO users (id, employeeId, employeeName, department, role, username, passwordHash, email, phone, status, lastLogin, createdAt)
       VALUES (@id, @employeeId, @employeeName, @department, @role, @username, @passwordHash, @email, @phone, @status, @lastLogin, @createdAt)`
    )
    .run(newUser);
  return newUser;
}
export function touchLastLogin(id: string) {
  sqlite.prepare(`UPDATE users SET lastLogin = ? WHERE id = ?`).run(new Date().toISOString(), id);
}

export function countActiveAdmins(excludingId?: string): number {
  const row = sqlite
    .prepare(
      `SELECT COUNT(*) as c FROM users WHERE role = 'STORE_ADMIN' AND status = 'Active' ${
        excludingId ? "AND id != ?" : ""
      }`
    )
    .get(...(excludingId ? [excludingId] : [])) as { c: number };
  return row.c;
}

export function updateUser(
  id: string,
  patch: Partial<Pick<User, "employeeId" | "employeeName" | "department" | "role" | "email" | "phone" | "status" | "username">> & {
    password?: string;
  }
): User | null {
  const existing = getUserById(id);
  if (!existing) return null;

  const merged: User = {
    ...existing,
    ...(patch.employeeId !== undefined && { employeeId: patch.employeeId }),
    ...(patch.employeeName !== undefined && { employeeName: patch.employeeName }),
    ...(patch.department !== undefined && { department: patch.department as User["department"] }),
    ...(patch.role !== undefined && { role: patch.role as Role }),
    ...(patch.email !== undefined && { email: patch.email }),
    ...(patch.phone !== undefined && { phone: patch.phone }),
    ...(patch.status !== undefined && { status: patch.status as User["status"] }),
    ...(patch.username !== undefined && { username: patch.username }),
  };
  if (patch.password) {
    merged.passwordHash = bcrypt.hashSync(patch.password, 8);
  }

  sqlite
    .prepare(
      `UPDATE users SET employeeId=@employeeId, employeeName=@employeeName, department=@department, role=@role, email=@email, phone=@phone, status=@status, username=@username, passwordHash=@passwordHash WHERE id=@id`
    )
    .run(merged);

  return merged;
}

export function deleteUser(id: string): boolean {
  const res = sqlite.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  return res.changes > 0;
}
export function resetUserPassword(id: string, newPassword: string) {
  const hash = bcrypt.hashSync(newPassword, 8);
  sqlite.prepare(`UPDATE users SET passwordHash = ? WHERE id = ?`).run(hash, id);
}

// --- Materials -------------------------------------------------------------
export function listMaterials(filter?: { department?: Department | "All"; query?: string }): Material[] {
  let sql = `SELECT * FROM materials WHERE 1=1`;
  const args: unknown[] = [];
  if (filter?.department && filter.department !== "All") {
    sql += ` AND department = ?`;
    args.push(filter.department);
  }
  if (filter?.query) {
    const q = `%${filter.query.toLowerCase()}%`;
    sql += ` AND (lower(description) LIKE ? OR lower(partNumber) LIKE ? OR lower(category) LIKE ? OR lower(location) LIKE ? OR lower(department) LIKE ? OR lower(supplier) LIKE ?)`;
    args.push(q, q, q, q, q, q);
  }
  sql += ` ORDER BY createdDate DESC`;
  return sqlite.prepare(sql).all(...args) as Material[];
}
export function getMaterialByPartNumber(pn: string): Material | undefined {
  return sqlite.prepare(`SELECT * FROM materials WHERE partNumber = ?`).get(pn) as Material | undefined;
}
export function getMaterialById(id: string): Material | undefined {
  return sqlite.prepare(`SELECT * FROM materials WHERE id = ?`).get(id) as Material | undefined;
}
export function createMaterial(m: Omit<Material, "id" | "createdDate" | "modifiedDate">): Material {
  const newMat: Material = {
    ...m,
    id: uid("mat"),
    createdDate: todayISO(),
    modifiedDate: todayISO(),
  };
  sqlite
    .prepare(
      `INSERT INTO materials (id, description, partNumber, category, department, unit, location, warehouse, rack, row, shelf, minStock, maxStock, currentStock, openingStock, unitValue, status, remarks, createdDate, createdBy, modifiedDate, modifiedBy, lastInwardDate, lastOutwardDate, supplier)
       VALUES (@id, @description, @partNumber, @category, @department, @unit, @location, @warehouse, @rack, @row, @shelf, @minStock, @maxStock, @currentStock, @openingStock, @unitValue, @status, @remarks, @createdDate, @createdBy, @modifiedDate, @modifiedBy, @lastInwardDate, @lastOutwardDate, @supplier)`
    )
    .run(newMat);
  return newMat;
}
export function updateMaterial(id: string, patch: Partial<Material>, modifiedBy: string): Material | null {
  const existing = getMaterialById(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch, modifiedDate: todayISO(), modifiedBy };
  sqlite
    .prepare(
      `UPDATE materials SET partNumber=@partNumber, description=@description, category=@category, department=@department, unit=@unit,
        location=@location, warehouse=@warehouse, rack=@rack, row=@row, shelf=@shelf,
        minStock=@minStock, maxStock=@maxStock, currentStock=@currentStock, unitValue=@unitValue,
        status=@status, remarks=@remarks, modifiedDate=@modifiedDate, modifiedBy=@modifiedBy, supplier=@supplier
       WHERE id=@id`
    )
    .run(merged);
  return merged;
}
export function deleteMaterial(id: string): boolean {
  const res = sqlite.prepare(`DELETE FROM materials WHERE id = ?`).run(id);
  return res.changes > 0;
}

export function stockStatus(m: Material) {
  if (m.currentStock <= 0) return "Out of Stock" as const;
  if (m.currentStock <= m.minStock) return "Low" as const;
  if (m.currentStock > m.maxStock) return "Over Stock" as const;
  return "Normal" as const;
}

export function noMovementDays(m: Material) {
  if (!m.lastOutwardDate) return null;
  const diff = Date.now() - new Date(m.lastOutwardDate).getTime();
  return Math.floor(diff / 86400000);
}

// --- Inward ----------------------------------------------------------------
export function listInward(filter?: { department?: Department | "All" }): InwardEntry[] {
  let sql = `SELECT * FROM inward WHERE 1=1`;
  const args: unknown[] = [];
  if (filter?.department && filter.department !== "All") {
    sql += ` AND department = ?`;
    args.push(filter.department);
  }
  sql += ` ORDER BY createdAt DESC`;
  return sqlite.prepare(sql).all(...args) as InwardEntry[];
}
export function getInwardById(id: string): InwardEntry | undefined {
  return sqlite.prepare(`SELECT * FROM inward WHERE id = ?`).get(id) as InwardEntry | undefined;
}
export function createInward(entry: Omit<InwardEntry, "id" | "createdAt">, actor: string): InwardEntry {
  const newEntry: InwardEntry = { ...entry, id: uid("inw"), createdAt: new Date().toISOString() };
  sqlite
    .prepare(
      `INSERT INTO inward (id, date, month, supplier, invoiceNumber, grnNumber, partNumber, description, category, department, quantity, unit, unitValue, receivedBy, verifiedBy, remarks, createdAt)
       VALUES (@id, @date, @month, @supplier, @invoiceNumber, @grnNumber, @partNumber, @description, @category, @department, @quantity, @unit, @unitValue, @receivedBy, @verifiedBy, @remarks, @createdAt)`
    )
    .run(newEntry);

  const mat = getMaterialByPartNumber(entry.partNumber);
  if (mat) {
    sqlite
      .prepare(`UPDATE materials SET currentStock = currentStock + ?, lastInwardDate = ?, modifiedDate = ?, modifiedBy = ? WHERE id = ?`)
      .run(entry.quantity, entry.date, todayISO(), actor, mat.id);
  }
  logAudit(actor, "INWARD_CREATE", "-", `+${entry.quantity} ${entry.unit} of ${entry.partNumber}`);
  return newEntry;
}
export function updateInward(
  id: string,
  patch: Partial<Pick<InwardEntry, "date" | "supplier" | "invoiceNumber" | "grnNumber" | "quantity" | "unitValue" | "receivedBy" | "verifiedBy" | "remarks">>,
  actor: string
): InwardEntry | null {
  const entry = getInwardById(id);
  if (!entry) return null;

  const mat = getMaterialByPartNumber(entry.partNumber);
  if (patch.quantity !== undefined && patch.quantity !== entry.quantity) {
    const delta = patch.quantity - entry.quantity;
    if (mat) {
      sqlite
        .prepare(`UPDATE materials SET currentStock = currentStock + ?, modifiedDate = ?, modifiedBy = ? WHERE id = ?`)
        .run(delta, todayISO(), actor, mat.id);
    }
  }

  const oldSnapshot = `qty:${entry.quantity}`;
  const merged = { ...entry, ...patch };
  if (patch.date) merged.month = new Date(patch.date).toLocaleString("default", { month: "long" });

  sqlite
    .prepare(
      `UPDATE inward SET date=@date, month=@month, supplier=@supplier, invoiceNumber=@invoiceNumber, grnNumber=@grnNumber, quantity=@quantity, unitValue=@unitValue, receivedBy=@receivedBy, verifiedBy=@verifiedBy, remarks=@remarks WHERE id=@id`
    )
    .run(merged);

  logAudit(actor, "INWARD_EDIT", oldSnapshot, `qty:${merged.quantity}`);
  return merged;
}

export function deleteInward(id: string, actor: string): { ok: boolean; error?: string } {
  const entry = getInwardById(id);
  if (!entry) return { ok: false, error: "Entry not found" };

  const mat = getMaterialByPartNumber(entry.partNumber);
  if (mat) {
    // Reversing an inward means removing the stock it added. Block if that
    // would push stock negative (e.g. some of it has since been issued out).
    if (mat.currentStock - entry.quantity < 0) {
      return {
        ok: false,
        error: `Can't delete — ${entry.quantity - mat.currentStock} unit(s) of this inward have already been issued out. Adjust or delete the related outward entries first.`,
      };
    }
    sqlite
      .prepare(`UPDATE materials SET currentStock = currentStock - ?, modifiedDate = ?, modifiedBy = ? WHERE id = ?`)
      .run(entry.quantity, todayISO(), actor, mat.id);
  }

  sqlite.prepare(`DELETE FROM inward WHERE id = ?`).run(id);
  logAudit(actor, "INWARD_DELETE", `${entry.partNumber} qty:${entry.quantity}`, "-");
  return { ok: true };
}

// --- Outward -----------------------------------------------------------------
export function listOutward(filter?: { department?: Department | "All" }): OutwardEntry[] {
  let sql = `SELECT * FROM outward WHERE 1=1`;
  const args: unknown[] = [];
  if (filter?.department && filter.department !== "All") {
    sql += ` AND department = ?`;
    args.push(filter.department);
  }
  sql += ` ORDER BY createdAt DESC`;
  return sqlite.prepare(sql).all(...args) as OutwardEntry[];
}
export function getOutwardById(id: string): OutwardEntry | undefined {
  return sqlite.prepare(`SELECT * FROM outward WHERE id = ?`).get(id) as OutwardEntry | undefined;
}
export function createOutward(entry: Omit<OutwardEntry, "id" | "createdAt">, actor: string): OutwardEntry {
  const newEntry: OutwardEntry = { ...entry, id: uid("out"), createdAt: new Date().toISOString() };
  sqlite
    .prepare(
      `INSERT INTO outward (id, date, month, partNumber, description, category, quantity, nos, issuedTo, purpose, receivedBy, department, issuedBy, remarks, createdAt)
       VALUES (@id, @date, @month, @partNumber, @description, @category, @quantity, @nos, @issuedTo, @purpose, @receivedBy, @department, @issuedBy, @remarks, @createdAt)`
    )
    .run(newEntry);

  const mat = getMaterialByPartNumber(entry.partNumber);
  if (mat) {
    sqlite
      .prepare(`UPDATE materials SET currentStock = MAX(0, currentStock - ?), lastOutwardDate = ?, modifiedDate = ?, modifiedBy = ? WHERE id = ?`)
      .run(entry.quantity, entry.date, todayISO(), actor, mat.id);
  }
  logAudit(actor, "OUTWARD_CREATE", "-", `-${entry.quantity} Nos of ${entry.partNumber}`);
  return newEntry;
}
export function updateOutward(
  id: string,
  patch: Partial<Pick<OutwardEntry, "date" | "quantity" | "issuedTo" | "purpose" | "receivedBy" | "remarks">>,
  actor: string
): { entry?: OutwardEntry; error?: string } {
  const entry = getOutwardById(id);
  if (!entry) return { error: "Entry not found" };

  const mat = getMaterialByPartNumber(entry.partNumber);

  if (patch.quantity !== undefined && patch.quantity !== entry.quantity) {
    const delta = patch.quantity - entry.quantity; // positive = issuing more, needs more stock
    if (mat && mat.currentStock - delta < 0) {
      return { error: `Insufficient stock to increase issued quantity. Available: ${mat.currentStock}` };
    }
    if (mat) {
      sqlite
        .prepare(`UPDATE materials SET currentStock = currentStock - ?, modifiedDate = ?, modifiedBy = ? WHERE id = ?`)
        .run(delta, todayISO(), actor, mat.id);
    }
  }

  const oldSnapshot = `qty:${entry.quantity}`;
  const merged = { ...entry, ...patch };
  merged.nos = merged.quantity;
  if (patch.date) merged.month = new Date(patch.date).toLocaleString("default", { month: "long" });

  sqlite
    .prepare(
      `UPDATE outward SET date=@date, month=@month, quantity=@quantity, nos=@nos, issuedTo=@issuedTo, purpose=@purpose, receivedBy=@receivedBy, remarks=@remarks WHERE id=@id`
    )
    .run(merged);

  logAudit(actor, "OUTWARD_EDIT", oldSnapshot, `qty:${merged.quantity}`);
  return { entry: merged };
}

export function deleteOutward(id: string, actor: string): { ok: boolean; error?: string } {
  const entry = getOutwardById(id);
  if (!entry) return { ok: false, error: "Entry not found" };

  const mat = getMaterialByPartNumber(entry.partNumber);
  if (mat) {
    // Reversing an outward gives the stock back — always safe, unlike
    // reversing an inward (which can't go negative).
    sqlite
      .prepare(`UPDATE materials SET currentStock = currentStock + ?, modifiedDate = ?, modifiedBy = ? WHERE id = ?`)
      .run(entry.quantity, todayISO(), actor, mat.id);
  }

  sqlite.prepare(`DELETE FROM outward WHERE id = ?`).run(id);
  logAudit(actor, "OUTWARD_DELETE", `${entry.partNumber} qty:${entry.quantity}`, "-");
  return { ok: true };
}

// --- Notification recipients ------------------------------------------------
/** Store Admins (always notified) + the Process Owner(s) of the given department. */
export function getNotificationRecipients(department: Department): string[] {
  const rows = sqlite
    .prepare(
      `SELECT email FROM users
       WHERE status = 'Active'
         AND (role = 'STORE_ADMIN' OR (role = 'PROCESS_OWNER' AND department = ?))`
    )
    .all(department) as { email: string }[];
  // Two accounts pointing at one shared mailbox (or the same address typed
  // with different casing) would otherwise receive the message twice.
  return dedupeEmails(rows.map((r) => r.email));
}

/** Trims, drops blanks, and removes case-insensitive repeats, preserving order. */
export function dedupeEmails(addresses: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of addresses) {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

// --- Email log ---------------------------------------------------------------
export interface EmailLogEntry {
  id: string;
  dedupeKey: string | null;
  recipients: string;
  subject: string;
  status: string;
  detail: string | null;
  transport: string | null;
  date: string;
  createdAt: string;
}

export function recordEmail(entry: {
  dedupeKey?: string | null;
  recipients: string[];
  subject: string;
  status: "sent" | "failed" | "skipped" | "outbox";
  detail?: string | null;
  transport?: "smtp" | "outbox" | null;
}) {
  sqlite
    .prepare(
      `INSERT INTO email_log (id, dedupeKey, recipients, subject, status, detail, transport, date, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      uid("eml"),
      entry.dedupeKey ?? null,
      entry.recipients.join(", "),
      entry.subject,
      entry.status,
      entry.detail ?? null,
      entry.transport ?? null,
      todayISO(),
      new Date().toISOString()
    );
}

/**
 * True if this exact notification already went out today. Used to stop a
 * low-stock alert firing again on every subsequent issue of the same part —
 * the single biggest source of duplicate mail in the app.
 */
export function alreadySentToday(dedupeKey: string): boolean {
  const row = sqlite
    .prepare(
      `SELECT COUNT(*) as c FROM email_log
       WHERE dedupeKey = ? AND date = ? AND status IN ('sent','outbox')`
    )
    .get(dedupeKey, todayISO()) as { c: number };
  return row.c > 0;
}

export function listEmailLog(limit = 100): EmailLogEntry[] {
  return sqlite
    .prepare(`SELECT * FROM email_log ORDER BY createdAt DESC LIMIT ?`)
    .all(limit) as EmailLogEntry[];
}

// --- App Settings ------------------------------------------------------------
export const DEFAULT_SETTINGS = {
  companyName: "PED Tool Room",
  companyTagline: "Production Engineering Department — Store & Inventory Management",
  lowStockAlertsEnabled: "true",
  dailyDigestEnabled: "true",
  dailyDigestHour: "8",
  lastDigestSentDate: "",
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: "false",
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
};

export type SettingsMap = typeof DEFAULT_SETTINGS;

export type ClearableModule = "materials" | "inward" | "outward";

/** Row counts per module, so the UI can say exactly what's about to go. */
export function countModuleRows(): Record<ClearableModule, number> {
  const one = (table: string) =>
    (sqlite.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
  return { materials: one("materials"), inward: one("inward"), outward: one("outward") };
}

/**
 * Empties one module. Deliberately per-module rather than one blanket wipe, so
 * clearing the Inward register can't silently take the Material Master with it.
 *
 * Clearing a transaction register rolls the stock it moved back out of
 * Material Master, otherwise every remaining material would keep stock that
 * no longer has any entry backing it. Materials themselves are only clearable
 * once both registers are empty — deleting them first would leave inward and
 * outward rows pointing at part numbers that no longer exist.
 */
export function clearModule(
  module: ClearableModule,
  actor: string
): { ok: boolean; error?: string; deleted?: number; backupPath?: string } {
  const before = countModuleRows();

  if (module === "materials" && (before.inward > 0 || before.outward > 0)) {
    return {
      ok: false,
      error: `Clear the transaction registers first — there ${before.inward + before.outward === 1 ? "is" : "are"} still ${before.inward} inward and ${before.outward} outward ${before.inward + before.outward === 1 ? "entry" : "entries"} referring to these materials.`,
    };
  }

  // Safety copy lands on disk BEFORE anything is deleted, so any clear —
  // including a mistaken one — is always recoverable from data/backups/.
  // A failure here aborts the clear rather than proceeding unprotected.
  let backupPath: string;
  try {
    backupPath = backupDatabase(`pre-clear-${module}`);
  } catch (err) {
    return {
      ok: false,
      error: `Couldn't write a safety backup, so nothing was deleted. ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
    };
  }

  const run = sqlite.transaction(() => {
    if (module === "inward") {
      // Take back the stock these entries added.
      sqlite.exec(`
        UPDATE materials SET currentStock = MAX(0, currentStock - COALESCE(
          (SELECT SUM(quantity) FROM inward WHERE inward.partNumber = materials.partNumber), 0))
      `);
      sqlite.exec(`UPDATE materials SET lastInwardDate = NULL`);
    } else if (module === "outward") {
      // Put back the stock these entries took out.
      sqlite.exec(`
        UPDATE materials SET currentStock = currentStock + COALESCE(
          (SELECT SUM(quantity) FROM outward WHERE outward.partNumber = materials.partNumber), 0)
      `);
      sqlite.exec(`UPDATE materials SET lastOutwardDate = NULL`);
    }
    sqlite.prepare(`DELETE FROM ${module}`).run();
  });
  run();

  logAudit(
    actor,
    `${module.toUpperCase()}_CLEAR_ALL`,
    `${before[module]} rows`,
    `0 rows (cleared from Settings; backup: ${backupPath})`
  );
  return { ok: true, deleted: before[module], backupPath };
}

export function getSettings(): SettingsMap {
  const rows = sqlite.prepare(`SELECT key, value FROM app_settings`).all() as { key: string; value: string }[];
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...stored } as SettingsMap;
}

export function updateSettings(patch: Partial<SettingsMap>): SettingsMap {
  const upsert = sqlite.prepare(
    `INSERT INTO app_settings (key, value) VALUES (@key, @value)
     ON CONFLICT(key) DO UPDATE SET value = @value`
  );
  const tx = sqlite.transaction((entries: [string, string][]) => {
    for (const [key, value] of entries) upsert.run({ key, value });
  });
  tx(Object.entries(patch) as [string, string][]);
  return getSettings();
}

// --- Audit log ---------------------------------------------------------------
export function listAuditLog(): AuditLogEntry[] {
  return sqlite.prepare(`SELECT * FROM audit_log ORDER BY id DESC LIMIT 500`).all() as AuditLogEntry[];
}

// --- Monthly budget ------------------------------------------------------
/** "Establishing cost" — one total spend allocation a Store Admin sets for
 *  the whole store for a given month. `month` is always "YYYY-MM"; the app
 *  auto-resolves which month to show (current month by default) rather than
 *  asking for a date. Spend is what's brought into the store that month
 *  (inward qty × unit value) — the procurement cost the budget is meant to
 *  cover — broken down by department for visibility, but the budget itself
 *  is one company-wide figure, not one per department. */
function currentMonthISO(): string {
  return new Date().toISOString().slice(0, 7);
}

function previousMonthISO(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1)); // m is 1-indexed; -2 steps back one month
  return d.toISOString().slice(0, 7);
}

export function getMonthlyBudget(month: string): number {
  const row = sqlite.prepare(`SELECT amount FROM monthly_budgets WHERE month = ?`).get(month) as
    | { amount: number }
    | undefined;
  return row?.amount ?? 0;
}

export function setMonthlyBudget(month: string, amount: number, actor: string): void {
  const now = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO monthly_budgets (id, month, amount, createdBy, createdAt, modifiedBy, modifiedDate)
       VALUES (@id, @month, @amount, @actor, @now, @actor, @now)
       ON CONFLICT(month) DO UPDATE SET amount = @amount, modifiedBy = @actor, modifiedDate = @now`
    )
    .run({ id: uid("bud"), month, amount, actor, now });
  logAudit(actor, "BUDGET_SET", "-", `${month}: ₹${amount.toLocaleString()}`);
}

/** Total value (qty × the value recorded on each inward entry itself — not
 *  Material Master's current value, since that can drift after the fact)
 *  brought into a department within a given "YYYY-MM" month. Pass
 *  `department: null` for the store-wide total across all departments. */
function inwardSpendForMonth(month: string, department: Department | null): number {
  const row = department
    ? (sqlite
        .prepare(`SELECT COALESCE(SUM(quantity * unitValue), 0) as total FROM inward WHERE department = ? AND substr(date, 1, 7) = ?`)
        .get(department, month) as { total: number })
    : (sqlite
        .prepare(`SELECT COALESCE(SUM(quantity * unitValue), 0) as total FROM inward WHERE substr(date, 1, 7) = ?`)
        .get(month) as { total: number });
  return row.total;
}

export interface DepartmentSpend {
  department: Department;
  spent: number;
  lastMonthSpent: number;
  yearToDateSpent: number;
}

export interface BudgetOverview {
  month: string;
  budget: number;
  spent: number;
  balance: number;
  lastMonth: { month: string; spent: number };
  yearToDate: { year: string; spent: number };
  byDepartment: DepartmentSpend[];
}

export function getBudgetOverview(month: string = currentMonthISO()): BudgetOverview {
  const lastMonth = previousMonthISO(month);
  const year = month.slice(0, 4);
  const budget = getMonthlyBudget(month);
  const spent = inwardSpendForMonth(month, null);

  const byDepartment: DepartmentSpend[] = DEPARTMENTS.map((department) => ({
    department,
    spent: inwardSpendForMonth(month, department),
    lastMonthSpent: inwardSpendForMonth(lastMonth, department),
    yearToDateSpent: yearSpend(department, year),
  }));

  return {
    month,
    budget,
    spent,
    balance: budget - spent,
    lastMonth: { month: lastMonth, spent: inwardSpendForMonth(lastMonth, null) },
    yearToDate: { year, spent: yearSpend(null, year) },
    byDepartment,
  };
}

function yearSpend(department: Department | null, year: string): number {
  const row = department
    ? (sqlite
        .prepare(`SELECT COALESCE(SUM(quantity * unitValue), 0) as total FROM inward WHERE department = ? AND substr(date, 1, 4) = ?`)
        .get(department, year) as { total: number })
    : (sqlite
        .prepare(`SELECT COALESCE(SUM(quantity * unitValue), 0) as total FROM inward WHERE substr(date, 1, 4) = ?`)
        .get(year) as { total: number });
  return row.total;
}

// --- Suppliers -----------------------------------------------------------
/** Suppliers aren't their own table — they're derived from whoever's named
 *  as a supplier in Material Master and/or the Inward register, so a
 *  supplier shows up here as soon as either one references them, even
 *  before anything's actually been received from them yet. */
export interface SupplierSummary {
  supplier: string;
  materialCount: number;
  totalQuantity: number;
  totalValue: number;
}

export function listSuppliers(query?: string): SupplierSummary[] {
  const names = sqlite
    .prepare(
      `SELECT DISTINCT supplier FROM (
         SELECT supplier FROM materials WHERE supplier IS NOT NULL AND trim(supplier) != ''
         UNION
         SELECT supplier FROM inward WHERE supplier IS NOT NULL AND trim(supplier) != ''
       )`
    )
    .all() as { supplier: string }[];

  const stats = sqlite
    .prepare(
      `SELECT supplier, COUNT(DISTINCT partNumber) as materialCount,
              SUM(quantity) as totalQuantity, SUM(quantity * unitValue) as totalValue
       FROM inward
       WHERE supplier IS NOT NULL AND trim(supplier) != ''
       GROUP BY supplier`
    )
    .all() as { supplier: string; materialCount: number; totalQuantity: number; totalValue: number }[];
  const statsByName = new Map(stats.map((s) => [s.supplier, s]));

  const summaries = names.map(({ supplier }) => {
    const s = statsByName.get(supplier);
    return {
      supplier,
      materialCount: s?.materialCount ?? 0,
      totalQuantity: s?.totalQuantity ?? 0,
      totalValue: s?.totalValue ?? 0,
    };
  });

  const filtered = query
    ? summaries.filter((s) => s.supplier.toLowerCase().includes(query.toLowerCase()))
    : summaries;

  return filtered.sort((a, b) => b.totalValue - a.totalValue || a.supplier.localeCompare(b.supplier));
}

export interface SupplierMaterialLine {
  partNumber: string;
  description: string;
  category: string;
  totalQuantity: number;
  totalValue: number;
  lastReceivedDate: string | null;
}

export interface SupplierDetail {
  supplier: string;
  totalQuantity: number;
  totalValue: number;
  materials: SupplierMaterialLine[];
}

export function getSupplierDetail(supplier: string): SupplierDetail {
  const rows = sqlite
    .prepare(
      `SELECT i.partNumber as partNumber,
              COALESCE(m.description, i.description) as description,
              COALESCE(m.category, i.category) as category,
              SUM(i.quantity) as totalQuantity,
              SUM(i.quantity * i.unitValue) as totalValue,
              MAX(i.date) as lastReceivedDate
       FROM inward i
       LEFT JOIN materials m ON m.partNumber = i.partNumber
       WHERE i.supplier = ?
       GROUP BY i.partNumber
       ORDER BY totalQuantity DESC`
    )
    .all(supplier) as SupplierMaterialLine[];

  return {
    supplier,
    totalQuantity: rows.reduce((sum, r) => sum + r.totalQuantity, 0),
    totalValue: rows.reduce((sum, r) => sum + r.totalValue, 0),
    materials: rows,
  };
}

export { DEPARTMENTS };
export type { Role };
