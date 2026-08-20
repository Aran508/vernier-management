import { SqliteDatabase } from "./sqliteDriver";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "ped-tool-room.db");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

/**
 * Writes a complete, consistent copy of the database and returns its path.
 *
 * Uses `VACUUM INTO`, which is synchronous and atomic — unlike the async
 * `.backup()` API it can be called inline from a synchronous mutation, so a
 * destructive operation cannot start before its safety copy is on disk.
 * Includes any pending WAL content, so the copy is never a stale snapshot.
 */
export function backupDatabase(reason: string): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeReason = reason.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const dest = path.join(BACKUP_DIR, `${safeReason}-${stamp}.db`);
  // VACUUM INTO refuses to overwrite, so a collision means the same reason
  // fired twice in one second — fall back to a unique suffix rather than throw.
  const target = fs.existsSync(dest) ? dest.replace(/\.db$/, `-${Date.now()}.db`) : dest;
  sqlite.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  return path.relative(process.cwd(), target);
}

// Reuse a single connection across hot reloads in dev
const globalForDb = globalThis as unknown as { __PED_SQLITE__?: SqliteDatabase };

/** Idempotent ALTER TABLE ADD COLUMN — checks the schema first instead of
 *  relying on try/catch, so it's explicit which installs actually needed
 *  the migration. Returns true if the column was just added. */
function addColumnIfMissing(db: SqliteDatabase, table: string, column: string, definition: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
}

/** All table/index DDL. Idempotent — safe to run on every load. */
function applySchema(db: SqliteDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      employeeName TEXT NOT NULL,
      department TEXT NOT NULL,
      role TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      lastLogin TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      partNumber TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      department TEXT NOT NULL,
      unit TEXT NOT NULL,
      location TEXT,
      warehouse TEXT,
      rack TEXT,
      row TEXT,
      shelf TEXT,
      minStock REAL NOT NULL DEFAULT 0,
      maxStock REAL NOT NULL DEFAULT 0,
      currentStock REAL NOT NULL DEFAULT 0,
      openingStock REAL NOT NULL DEFAULT 0,
      unitValue REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Active',
      remarks TEXT,
      createdDate TEXT,
      createdBy TEXT,
      modifiedDate TEXT,
      modifiedBy TEXT,
      lastInwardDate TEXT,
      lastOutwardDate TEXT,
      supplier TEXT
    );

    CREATE TABLE IF NOT EXISTS inward (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      month TEXT,
      supplier TEXT,
      invoiceNumber TEXT,
      grnNumber TEXT,
      partNumber TEXT NOT NULL,
      description TEXT,
      category TEXT,
      department TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT,
      unitValue REAL NOT NULL DEFAULT 0,
      receivedBy TEXT,
      verifiedBy TEXT,
      remarks TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outward (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      month TEXT,
      partNumber TEXT NOT NULL,
      description TEXT,
      category TEXT,
      quantity REAL NOT NULL,
      nos REAL,
      issuedTo TEXT,
      purpose TEXT,
      receivedBy TEXT,
      department TEXT NOT NULL,
      issuedBy TEXT,
      remarks TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user TEXT NOT NULL,
      action TEXT NOT NULL,
      oldValue TEXT,
      newValue TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      ipAddress TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monthly_budgets (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL DEFAULT 0,
      createdBy TEXT,
      createdAt TEXT NOT NULL,
      modifiedBy TEXT,
      modifiedDate TEXT
    );

    -- Every send attempt, so a failure is visible instead of silent, and so
    -- repeat alerts can be suppressed. dedupeKey is the "don't send this same
    -- thing again today" identity (e.g. low-stock:44FT-0001).
    CREATE TABLE IF NOT EXISTS email_log (
      id TEXT PRIMARY KEY,
      dedupeKey TEXT,
      recipients TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,          -- sent | failed | skipped | written-to-outbox
      detail TEXT,
      transport TEXT,                -- smtp | outbox
      date TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_email_log_dedupe ON email_log(dedupeKey, date);
    CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log(createdAt DESC);

    CREATE INDEX IF NOT EXISTS idx_materials_department ON materials(department);
    CREATE INDEX IF NOT EXISTS idx_inward_department ON inward(department);
    CREATE INDEX IF NOT EXISTS idx_outward_department ON outward(department);
  `);
}

function init() {
  const db = new SqliteDatabase(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 15000");

  applySchema(db);

  // Superseded by monthly_budgets (one total budget per month, rather than
  // one per department) — drop the old table; it was only ever populated in
  // pre-release testing, nothing real to preserve.
  db.exec(`DROP TABLE IF EXISTS department_budgets;`);

  // Existing installs from before GRN/unit-value tracking was added to
  // Inward need these columns added on top of their current schema.
  const addedUnitValue = addColumnIfMissing(db, "inward", "unitValue", "REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "inward", "grnNumber", "TEXT");
  if (addedUnitValue) {
    // Best-effort backfill for rows recorded before this column existed —
    // use the material's current unit value as a stand-in for the actual
    // price paid, since that's the only reference available retroactively.
    db.exec(`
      UPDATE inward SET unitValue = (
        SELECT m.unitValue FROM materials m WHERE m.partNumber = inward.partNumber
      )
      WHERE unitValue = 0
        AND EXISTS (SELECT 1 FROM materials m WHERE m.partNumber = inward.partNumber AND m.unitValue > 0)
    `);
  }

  // "Burnishing" was renamed to "Burnishing & Project" — carry forward any
  // rows created under the old name so existing installs don't end up with
  // orphaned records that no longer match the Department type.
  for (const table of ["users", "materials", "inward", "outward"]) {
    db.prepare(`UPDATE ${table} SET department = 'Burnishing & Project' WHERE department = 'Burnishing'`).run();
  }

  // Seed only login accounts — no demo materials/transactions. Real data is
  // entered by your team through the app.
  const userCount = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, employeeId, employeeName, department, role, username, passwordHash, email, phone, status, lastLogin, createdAt)
      VALUES (@id, @employeeId, @employeeName, @department, @role, @username, @passwordHash, @email, @phone, 'Active', NULL, @createdAt)
    `);
    const now = new Date().toISOString().slice(0, 10);
    const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
    const hash = (pw: string) => bcrypt.hashSync(pw, 8);

    const seedUsers = [
      { employeeId: "EMP-0001", employeeName: "Store Administrator", department: "All", role: "STORE_ADMIN", username: "admin", password: "admin123", email: "store.admin@ped.local", phone: "9000000001" },
      { employeeId: "EMP-0101", employeeName: "Machining Process Owner", department: "Machining", role: "PROCESS_OWNER", username: "machining.po", password: "owner123", email: "machining.po@ped.local", phone: "9000000010" },
      { employeeId: "EMP-0102", employeeName: "Welding Process Owner", department: "Welding", role: "PROCESS_OWNER", username: "welding.po", password: "owner123", email: "welding.po@ped.local", phone: "9000000011" },
      { employeeId: "EMP-0103", employeeName: "Assembly & Testing Process Owner", department: "Assembly & Testing", role: "PROCESS_OWNER", username: "assembly.po", password: "owner123", email: "assembly.po@ped.local", phone: "9000000012" },
      { employeeId: "EMP-0104", employeeName: "Burnishing & Project Process Owner", department: "Burnishing & Project", role: "PROCESS_OWNER", username: "burnishing.po", password: "owner123", email: "burnishing.po@ped.local", phone: "9000000013" },
      { employeeId: "EMP-0201", employeeName: "Monitoring User 1", department: "All", role: "MONITORING", username: "monitor1", password: "monitor123", email: "monitor1@ped.local", phone: "9000000110" },
      { employeeId: "EMP-0202", employeeName: "Monitoring User 2", department: "All", role: "MONITORING", username: "monitor2", password: "monitor123", email: "monitor2@ped.local", phone: "9000000111" },
      { employeeId: "EMP-0203", employeeName: "Monitoring User 3", department: "All", role: "MONITORING", username: "monitor3", password: "monitor123", email: "monitor3@ped.local", phone: "9000000112" },
    ];

    const insertMany = db.transaction((rows: typeof seedUsers) => {
      for (const u of rows) {
        insertUser.run({
          id: uid("usr"),
          employeeId: u.employeeId,
          employeeName: u.employeeName,
          department: u.department,
          role: u.role,
          username: u.username,
          passwordHash: hash(u.password),
          email: u.email,
          phone: u.phone,
          createdAt: now,
        });
      }
    });
    try {
      insertMany(seedUsers);
    } catch (err) {
      // Multiple processes (e.g. parallel build workers) can all observe
      // userCount === 0 before any of them commits. If another process won
      // the race and already seeded, back off instead of crashing.
      const already = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c > 0;
      if (!already) throw err;
    }
  }

  return db;
}

if (!globalForDb.__PED_SQLITE__) {
  globalForDb.__PED_SQLITE__ = init();
} else {
  // The connection is cached across hot reloads, which means init() — and the
  // CREATE TABLE IF NOT EXISTS statements inside it — won't run again. A table
  // added to the schema would then be missing for the life of the dev server
  // ("no such table"). Re-applying the DDL is idempotent and cheap, so do it
  // on every module load rather than only on first connect.
  applySchema(globalForDb.__PED_SQLITE__);
}

export const sqlite = globalForDb.__PED_SQLITE__;
