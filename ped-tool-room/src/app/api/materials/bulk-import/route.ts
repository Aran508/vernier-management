import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createMaterial, getMaterialByPartNumber, logAudit } from "@/lib/db";
import { DEPARTMENTS } from "@/lib/types";
import { normalizeImportRows } from "@/lib/importNormalize";

interface ImportRow {
  partNumber?: string;
  description?: string;
  category?: string;
  department?: string;
  unit?: string;
  location?: string;
  minStock?: string | number;
  maxStock?: string | number;
  openingStock?: string | number;
  unitValue?: string | number;
  supplier?: string;
  remarks?: string;
}

/**
 * Generates a placeholder part number for a row that arrived with no part
 * number at all, so the row can still be imported and completed later
 * (rather than being rejected outright). Checked against the database to
 * avoid any realistic chance of collision.
 */
function generatePlaceholderPartNumber(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `NEEDS-PN-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    if (!getMaterialByPartNumber(candidate)) return candidate;
  }
  // Astronomically unlikely to ever reach this, but stay safe regardless.
  return `NEEDS-PN-${crypto.randomUUID()}`;
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Only Store Admin can bulk-import materials" }, { status: 403 });
  }

  const body = await req.json();
  const rawRows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];
  if (rawRows.length === 0) {
    return NextResponse.json({ error: "No rows found in the file" }, { status: 400 });
  }
  if (rawRows.length > 2000) {
    return NextResponse.json({ error: "Maximum 2000 rows per import" }, { status: 400 });
  }
  const rows = normalizeImportRows(rawRows) as ImportRow[];

  const results = {
    created: 0,
    skipped: 0,
    incomplete: 0, // created, but missing one or more fields that need completing
    errors: [] as { row: number; reason: string }[],
    needsReview: [] as { row: number; partNumber: string; missing: string[] }[],
  };

  // No field is treated as a hard requirement anymore — every row is
  // imported with whatever data is present, and anything missing is left
  // blank for the user to fill in afterward from the Material Master edit
  // screen. The only case that isn't a plain import is an exact duplicate
  // part number, which is skipped (not overwritten) to protect existing data.
  rows.forEach((row, i) => {
    const rowNum = i + 2; // account for header row in the spreadsheet
    const missing: string[] = [];

    let partNumber = String(row.partNumber || "").trim();
    if (!partNumber) {
      partNumber = generatePlaceholderPartNumber();
      missing.push("Part Number");
    } else if (getMaterialByPartNumber(partNumber)) {
      // A genuine duplicate of existing data — skipped so we never silently
      // overwrite something already in the system. This is not a validation
      // failure; it's just not re-imported.
      results.skipped++;
      return;
    }

    const description = String(row.description || "").trim();
    if (!description) missing.push("Description");

    const category = String(row.category || "").trim();
    if (!category) missing.push("Category");

    const rawDepartment = String(row.department || "").trim();
    const matchedDept = DEPARTMENTS.find((d) => d.toLowerCase() === rawDepartment.toLowerCase());
    // A provided-but-unrecognized department is kept as-is (the person's
    // data is never discarded) rather than rejecting the row — it just
    // won't show up correctly scoped until corrected in the edit screen.
    const department = matchedDept || rawDepartment;
    if (!department) missing.push("Department");

    const unit = String(row.unit || "").trim();
    if (!unit) missing.push("Unit");

    if (row.minStock === undefined || row.minStock === "") missing.push("Min Stock");
    if (row.maxStock === undefined || row.maxStock === "") missing.push("Max Stock");

    const minStock = toSafeNumber(row.minStock, 0);
    const maxStock = toSafeNumber(row.maxStock, 0);
    const openingStock = toSafeNumber(row.openingStock, 0);
    const unitValue = toSafeNumber(row.unitValue, 0);

    createMaterial({
      description,
      partNumber,
      category,
      department: department as (typeof DEPARTMENTS)[number],
      unit,
      location: String(row.location || "").trim(),
      warehouse: "Warehouse A",
      rack: "-",
      row: "-",
      shelf: "-",
      minStock,
      maxStock,
      currentStock: openingStock,
      openingStock,
      unitValue,
      status: "Active",
      remarks: String(row.remarks || "").trim(),
      createdBy: session.username,
      modifiedBy: session.username,
      lastInwardDate: null,
      lastOutwardDate: null,
      supplier: String(row.supplier || "").trim(),
    });
    results.created++;
    if (missing.length > 0) {
      results.incomplete++;
      results.needsReview.push({ row: rowNum, partNumber, missing });
    }
  });

  logAudit(
    session.username,
    "MATERIAL_BULK_IMPORT",
    "-",
    `Created ${results.created} (${results.incomplete} need completing), skipped ${results.skipped} duplicates`
  );

  return NextResponse.json(results);
}
