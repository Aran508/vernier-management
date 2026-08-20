import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { deleteOutward, getOutwardById, updateOutward } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = getOutwardById(id);
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  if (session.role === "MONITORING") {
    return NextResponse.json({ error: "Monitoring users cannot edit entries" }, { status: 403 });
  }
  if (session.role === "PROCESS_OWNER" && existing.department !== session.department) {
    return NextResponse.json({ error: `You can only edit ${session.department} entries.` }, { status: 403 });
  }

  const body = await req.json();
  const patch: Record<string, unknown> = {};
  for (const f of ["date", "issuedTo", "purpose", "receivedBy", "remarks"] as const) {
    if (body[f] !== undefined) patch[f] = body[f];
  }
  if (body.quantity !== undefined) {
    const qty = Number(body.quantity);
    if (!qty || qty <= 0) {
      return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 });
    }
    patch.quantity = qty;
  }

  const result = updateOutward(id, patch, session.username);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.entry);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = getOutwardById(id);
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  if (session.role === "MONITORING") {
    return NextResponse.json({ error: "Monitoring users cannot delete entries" }, { status: 403 });
  }
  if (session.role === "PROCESS_OWNER" && existing.department !== session.department) {
    return NextResponse.json({ error: `You can only delete ${session.department} entries.` }, { status: 403 });
  }

  const result = deleteOutward(id, session.username);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
