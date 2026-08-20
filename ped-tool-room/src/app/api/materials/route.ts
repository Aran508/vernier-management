import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, scopedDepartment } from "@/lib/auth";
import { createMaterial, getMaterialByPartNumber, getNotificationRecipients, listMaterials, logAudit, noMovementDays, stockStatus } from "@/lib/db";
import { Department, DEPARTMENTS } from "@/lib/types";
import { sendMail } from "@/lib/mailer";
import { adminNotificationEmail } from "@/lib/emailTemplates";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scoped = scopedDepartment(session);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const deptParam = searchParams.get("department") as Department | "All" | null;

  const department = scoped !== "All" ? (scoped as Department) : deptParam || "All";

  const materials = listMaterials({ department, query: q }).map((m) => ({
    ...m,
    stockStatus: stockStatus(m),
    noMovementDays: noMovementDays(m),
  }));

  return NextResponse.json(materials);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Only Store Admin can add materials" }, { status: 403 });
  }
  const body = await req.json();

  const required = ["description", "partNumber", "category", "department", "unit", "minStock", "maxStock"];
  for (const f of required) {
    if (body[f] === undefined || body[f] === "") {
      return NextResponse.json({ error: `Missing field: ${f}` }, { status: 400 });
    }
  }

  const matchedDept = DEPARTMENTS.find((d) => d.toLowerCase() === String(body.department).toLowerCase());
  if (!matchedDept) {
    return NextResponse.json({ error: `Invalid department. Must be one of: ${DEPARTMENTS.join(", ")}` }, { status: 400 });
  }
  body.department = matchedDept;

  const minStock = Number(body.minStock);
  const maxStock = Number(body.maxStock);
  const openingStock = Number(body.openingStock ?? 0);
  const unitValue = Number(body.unitValue ?? 0);
  if ([minStock, maxStock, openingStock, unitValue].some((n) => Number.isNaN(n) || n < 0)) {
    return NextResponse.json({ error: "Stock and value fields must be non-negative numbers" }, { status: 400 });
  }
  if (minStock > maxStock) {
    return NextResponse.json({ error: "Minimum stock cannot be greater than maximum stock" }, { status: 400 });
  }

  const trimmedPartNumber = String(body.partNumber).trim();
  if (getMaterialByPartNumber(trimmedPartNumber)) {
    return NextResponse.json({ error: `Part number "${trimmedPartNumber}" already exists` }, { status: 409 });
  }

  const created = createMaterial({
    description: body.description,
    partNumber: trimmedPartNumber,
    category: body.category,
    department: body.department,
    unit: body.unit,
    location: body.location || "-",
    warehouse: body.warehouse || "Warehouse A",
    rack: body.rack || "-",
    row: body.row || "-",
    shelf: body.shelf || "-",
    minStock,
    maxStock,
    currentStock: openingStock,
    openingStock,
    unitValue,
    status: "Active",
    remarks: body.remarks || "",
    createdBy: session.username,
    modifiedBy: session.username,
    lastInwardDate: null,
    lastOutwardDate: null,
    supplier: body.supplier || "-",
  });

  logAudit(session.username, "MATERIAL_CREATE", "-", `Added material ${created.partNumber}`);

  sendMail({
    to: getNotificationRecipients(created.department),
    subject: `New Material Added: ${created.partNumber} — ${created.description}`,
    html: adminNotificationEmail({
      heading: "New Material Added",
      message: `${session.employeeName} added a new material to the ${created.department} store.`,
      details: {
        "Part Number": created.partNumber,
        Description: created.description,
        Category: created.category,
        Department: created.department,
        "Opening Stock": `${created.openingStock} ${created.unit}`,
        "Min / Max": `${created.minStock} / ${created.maxStock}`,
      },
    }),
  }).catch((err) => console.error("[materials] notification error:", err));

  return NextResponse.json(created, { status: 201 });
}
