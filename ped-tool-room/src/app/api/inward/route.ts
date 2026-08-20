import { NextRequest, NextResponse } from "next/server";
import { canManageTransactions, getSessionFromRequest, scopedDepartment } from "@/lib/auth";
import { createInward, getMaterialByPartNumber, getNotificationRecipients, listInward } from "@/lib/db";
import { Department } from "@/lib/types";
import { sendMail } from "@/lib/mailer";
import { materialReceivedEmail } from "@/lib/emailTemplates";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scoped = scopedDepartment(session);
  const { searchParams } = new URL(req.url);
  const deptParam = searchParams.get("department") as Department | "All" | null;
  const department = scoped !== "All" ? (scoped as Department) : deptParam || "All";
  return NextResponse.json(listInward({ department }));
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canManageTransactions(session)) {
    return NextResponse.json(
      { error: "Only Store Admin and Process Owners can perform inward entries" },
      { status: 403 }
    );
  }

  const body = await req.json();

  const mat = getMaterialByPartNumber(body.partNumber);
  if (!mat) {
    return NextResponse.json({ error: "Unknown part number. Add material first." }, { status: 404 });
  }

  // Process Owners are locked to their own department, even if the request tries to override it.
  if (session.role === "PROCESS_OWNER" && mat.department !== session.department) {
    return NextResponse.json(
      { error: `You can only enter inward for ${session.department} materials.` },
      { status: 403 }
    );
  }

  const qty = Number(body.quantity);
  if (!qty || qty <= 0) {
    return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 });
  }

  const unitValue = body.unitValue !== undefined && body.unitValue !== "" ? Number(body.unitValue) : mat.unitValue;
  if (Number.isNaN(unitValue) || unitValue < 0) {
    return NextResponse.json({ error: "Unit Value must be a non-negative number" }, { status: 400 });
  }

  const date = body.date || new Date().toISOString().slice(0, 10);
  const entry = createInward(
    {
      date,
      month: body.month || new Date(date).toLocaleString("default", { month: "long" }),
      supplier: body.supplier || mat.supplier,
      invoiceNumber: body.invoiceNumber || "-",
      grnNumber: body.grnNumber || "-",
      partNumber: mat.partNumber,
      description: body.description || mat.description,
      category: body.category || mat.category,
      department: mat.department,
      quantity: qty,
      unit: body.unit || mat.unit,
      unitValue,
      receivedBy: body.receivedBy || "-",
      verifiedBy: body.verifiedBy || session.username,
      remarks: body.remarks || "",
    },
    session.username
  );

  const recipients = getNotificationRecipients(entry.department);
  sendMail({
    to: recipients,
    subject: `Material Received: ${entry.partNumber} — ${entry.description}`,
    html: materialReceivedEmail({
      partNumber: entry.partNumber,
      description: entry.description,
      department: entry.department,
      quantity: entry.quantity,
      unit: entry.unit,
      supplier: entry.supplier,
      invoiceNumber: entry.invoiceNumber,
      receivedBy: entry.receivedBy,
      date: entry.date,
    }),
  }).catch((err) => console.error("[inward] notification error:", err));

  return NextResponse.json(entry, { status: 201 });
}
