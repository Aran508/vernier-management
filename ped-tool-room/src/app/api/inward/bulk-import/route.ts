import { NextRequest, NextResponse } from "next/server";
import { canManageTransactions, getSessionFromRequest, scopedDepartment } from "@/lib/auth";
import { createInward, createMaterial, getMaterialByPartNumber } from "@/lib/db";
import { normalizeImportRows } from "@/lib/importNormalize";
import { DEPARTMENTS } from "@/lib/types";

interface ImportRow {
  date?: string;
  partNumber?: string;
  description?: string;
  category?: string;
  department?: string;
  unit?: string;
  supplier?: string;
  invoiceNumber?: string;
  grnNumber?: string;
  quantity?: string | number;
  unitValue?: string | number;
  receivedBy?: string;
  verifiedBy?: string;
  remarks?: string;
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTransactions(session)) {
    return NextResponse.json({ error: "You don't have permission to import inward entries" }, { status: 403 });
  }

  const body = await req.json();
  const rawRows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];
  if (rawRows.length === 0) return NextResponse.json({ error: "No rows found in the file" }, { status: 400 });
  if (rawRows.length > 2000) return NextResponse.json({ error: "Maximum 2000 rows per import" }, { status: 400 });
  const rows = normalizeImportRows(rawRows) as ImportRow[];

  const scoped = scopedDepartment(session);
  const results = {
    created: 0,
    incomplete: 0,
    errors: [] as { row: number; reason: string }[],
    needsReview: [] as { row: number; partNumber: string; missing: string[] }[],
  };

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    const partNumber = String(row.partNumber || "").trim();

    // The one genuine hard requirement: without a part number there's
    // nothing to identify which material this row is even about, so there's
    // no meaningful way to import it at all (unlike other fields, this
    // isn't something that can just be "left blank and edited later").
    if (!partNumber) {
      results.errors.push({ row: rowNum, reason: "No part number in this row — there's nothing to attach the inward entry to." });
      return;
    }

    const missing: string[] = [];
    let mat = getMaterialByPartNumber(partNumber);

    if (!mat) {
      // Brand-new part number: create a minimal Material Master record from
      // whatever's in the row (same thing the inline "new part" flow on the
      // Inward page does), rather than rejecting the whole row.
      const description = String(row.description || "").trim();
      const category = String(row.category || "").trim();
      const unit = String(row.unit || "").trim();
      const rawDept = String(row.department || "").trim();
      const matchedDept = DEPARTMENTS.find((d) => d.toLowerCase() === rawDept.toLowerCase());
      const department = matchedDept || (scoped !== "All" ? scoped : rawDept);

      if (!description) missing.push("Description");
      if (!category) missing.push("Category");
      if (!unit) missing.push("Unit");
      if (!department) missing.push("Department");
      missing.push("Minimum Stock", "Maximum Stock"); // always need setting for a brand-new part

      mat = createMaterial({
        description,
        partNumber,
        category,
        department: department as (typeof DEPARTMENTS)[number],
        unit,
        location: "",
        warehouse: "Warehouse A",
        rack: "-",
        row: "-",
        shelf: "-",
        minStock: 0,
        maxStock: 0,
        currentStock: 0,
        openingStock: 0,
        unitValue: 0,
        status: "Active",
        remarks: "",
        createdBy: session.username,
        modifiedBy: session.username,
        lastInwardDate: null,
        lastOutwardDate: null,
        supplier: String(row.supplier || "").trim(),
      });
    }

    // A Process Owner can only bring stock into their own department —
    // this is a permission boundary, not a data-completeness issue, so it
    // stays a hard block.
    if (scoped !== "All" && mat.department !== scoped) {
      results.errors.push({ row: rowNum, reason: `"${partNumber}" belongs to ${mat.department || "an unset department"}, outside your department` });
      return;
    }

    let quantity = Number(row.quantity);
    if (!row.quantity || Number.isNaN(quantity) || quantity <= 0) {
      quantity = 0;
      missing.push("Quantity");
    }

    // Unit Value drives department budget spend — fall back to the
    // material's standard value if the row doesn't specify one, but flag it
    // for review so it doesn't silently end up as an untracked ₹0 like the
    // pre-GRN/value rows did.
    let unitValue = Number(row.unitValue);
    if (row.unitValue === undefined || row.unitValue === "" || Number.isNaN(unitValue) || unitValue < 0) {
      unitValue = mat.unitValue;
      if (!unitValue) missing.push("Unit Value");
    }

    const date = row.date || new Date().toISOString().slice(0, 10);
    createInward(
      {
        date,
        month: new Date(date).toLocaleString("default", { month: "long" }),
        supplier: String(row.supplier || mat.supplier || "").trim(),
        invoiceNumber: String(row.invoiceNumber || "").trim(),
        grnNumber: String(row.grnNumber || "").trim(),
        partNumber: mat.partNumber,
        description: mat.description,
        category: mat.category,
        department: mat.department,
        quantity,
        unit: mat.unit,
        unitValue,
        receivedBy: String(row.receivedBy || "").trim(),
        verifiedBy: String(row.verifiedBy || session.username).trim(),
        remarks: String(row.remarks || "").trim(),
      },
      session.username
    );
    results.created++;
    if (missing.length > 0) {
      results.incomplete++;
      results.needsReview.push({ row: rowNum, partNumber, missing });
    }
  });

  return NextResponse.json(results);
}
