import { NextRequest, NextResponse } from "next/server";
import { canManageTransactions, getSessionFromRequest, scopedDepartment } from "@/lib/auth";
import { createOutward, getMaterialByPartNumber, getNotificationRecipients, getSettings, listOutward, stockStatus } from "@/lib/db";
import { Department } from "@/lib/types";
import { sendMail } from "@/lib/mailer";
import { lowStockEmail, materialIssuedEmail } from "@/lib/emailTemplates";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scoped = scopedDepartment(session);
  const { searchParams } = new URL(req.url);
  const deptParam = searchParams.get("department") as Department | "All" | null;
  const department = scoped !== "All" ? (scoped as Department) : deptParam || "All";
  return NextResponse.json(listOutward({ department }));
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canManageTransactions(session)) {
    return NextResponse.json(
      { error: "Only Store Admin and Process Owners can perform outward entries" },
      { status: 403 }
    );
  }

  const body = await req.json();

  const mat = getMaterialByPartNumber(body.partNumber);
  if (!mat) {
    return NextResponse.json({ error: "Unknown part number" }, { status: 404 });
  }

  // Process Owners are locked to their own department, even if the request tries to override it.
  if (session.role === "PROCESS_OWNER" && mat.department !== session.department) {
    return NextResponse.json(
      { error: `You can only issue ${session.department} materials.` },
      { status: 403 }
    );
  }

  const qty = Number(body.quantity);
  if (!qty || qty <= 0) {
    return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 });
  }
  if (qty > mat.currentStock) {
    return NextResponse.json(
      { error: `Insufficient stock. Available: ${mat.currentStock} ${mat.unit}` },
      { status: 400 }
    );
  }

  const date = body.date || new Date().toISOString().slice(0, 10);
  const entry = createOutward(
    {
      date,
      month: body.month || new Date(date).toLocaleString("default", { month: "long" }),
      partNumber: mat.partNumber,
      description: body.description || mat.description,
      category: body.category || mat.category,
      quantity: qty,
      nos: body.nos ? Number(body.nos) : qty,
      issuedTo: body.issuedTo || "-",
      purpose: body.purpose || "-",
      receivedBy: body.receivedBy || "-",
      department: mat.department,
      issuedBy: session.username,
      remarks: body.remarks || "",
    },
    session.username
  );

  notifyOutward(entry).catch((err) => console.error("[outward] notification error:", err));

  return NextResponse.json(entry, { status: 201 });
}

/**
 * Fire-and-forget email notifications. Runs after the response-worthy work is
 * done; any SMTP failure is logged (see lib/mailer.ts) but never surfaces to
 * the caller — issuing material should never fail because email is down.
 */
async function notifyOutward(entry: {
  partNumber: string;
  description: string;
  department: Department;
  quantity: number;
  issuedTo: string;
  purpose: string;
  issuedBy: string;
  date: string;
}) {
  const recipients = getNotificationRecipients(entry.department);
  const mat = getMaterialByPartNumber(entry.partNumber);

  await sendMail({
    to: recipients,
    subject: `Material Issued: ${entry.partNumber} — ${entry.description}`,
    html: materialIssuedEmail({
      partNumber: entry.partNumber,
      description: entry.description,
      department: entry.department,
      quantity: entry.quantity,
      unit: mat?.unit || "Nos",
      issuedTo: entry.issuedTo,
      purpose: entry.purpose,
      issuedBy: entry.issuedBy,
      date: entry.date,
    }),
  });

  if (mat && (stockStatus(mat) === "Low" || stockStatus(mat) === "Out of Stock") && getSettings().lowStockAlertsEnabled === "true") {
    await sendMail({
      // Without this, issuing the same low part ten times sends ten identical
      // alerts. One per part per status per day is enough to act on.
      dedupeKey: `low-stock:${mat.partNumber}:${stockStatus(mat)}`,
      to: recipients,
      subject: `${stockStatus(mat) === "Out of Stock" ? "Stock Out" : "Low Stock"} Alert: ${mat.partNumber}`,
      html: lowStockEmail({
        partNumber: mat.partNumber,
        description: mat.description,
        department: mat.department,
        currentStock: mat.currentStock,
        minStock: mat.minStock,
        unit: mat.unit,
      }),
    });
  }
}
