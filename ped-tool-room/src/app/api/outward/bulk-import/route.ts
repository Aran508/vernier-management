import { NextRequest, NextResponse } from "next/server";
import { canManageTransactions, getSessionFromRequest, scopedDepartment } from "@/lib/auth";
import { createOutward, getMaterialByPartNumber } from "@/lib/db";
import { normalizeImportRows } from "@/lib/importNormalize";

interface ImportRow {
  date?: string;
  partNumber?: string;
  quantity?: string | number;
  issuedTo?: string;
  purpose?: string;
  receivedBy?: string;
  remarks?: string;
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTransactions(session)) {
    return NextResponse.json({ error: "You don't have permission to import outward entries" }, { status: 403 });
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

    // Two things stay as hard requirements for Outward specifically — not
    // because we're being strict about "completeness", but because issuing
    // stock is only meaningful against a real, existing, sufficiently
    // stocked material. There's no reasonable way to "leave that blank and
    // edit it later" the way there is for a description or a category.
    if (!partNumber) {
      results.errors.push({ row: rowNum, reason: "No part number in this row — there's nothing to issue stock against." });
      return;
    }
    const mat = getMaterialByPartNumber(partNumber);
    if (!mat) {
      results.errors.push({ row: rowNum, reason: `"${partNumber}" isn't in Material Master yet. Add it there (or via Inward) first, then re-import.` });
      return;
    }
    if (scoped !== "All" && mat.department !== scoped) {
      results.errors.push({ row: rowNum, reason: `"${partNumber}" belongs to ${mat.department}, outside your department` });
      return;
    }

    const missing: string[] = [];
    let quantity = Number(row.quantity);
    if (!row.quantity || Number.isNaN(quantity) || quantity <= 0) {
      // Quantity itself is left at 0 (no stock impact) rather than
      // rejecting the row — the entry is still created and can be
      // completed from the Outward edit screen afterward.
      quantity = 0;
      missing.push("Quantity");
    } else if (quantity > mat.currentStock) {
      results.errors.push({ row: rowNum, reason: `Insufficient stock for "${partNumber}" (available: ${mat.currentStock}, requested: ${quantity})` });
      return;
    }

    const date = row.date || new Date().toISOString().slice(0, 10);
    createOutward(
      {
        date,
        month: new Date(date).toLocaleString("default", { month: "long" }),
        partNumber: mat.partNumber,
        description: mat.description,
        category: mat.category,
        quantity,
        nos: quantity,
        issuedTo: String(row.issuedTo || "").trim(),
        purpose: String(row.purpose || "").trim(),
        receivedBy: String(row.receivedBy || "").trim(),
        department: mat.department,
        issuedBy: session.username,
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
