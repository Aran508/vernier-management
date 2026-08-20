import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, scopedDepartment } from "@/lib/auth";
import { deleteMaterial, getMaterialById, getMaterialByPartNumber, logAudit, noMovementDays, stockStatus, updateMaterial } from "@/lib/db";
import { DEPARTMENTS } from "@/lib/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mat = getMaterialById(id);
  if (!mat) return NextResponse.json({ error: "Material not found" }, { status: 404 });

  const scoped = scopedDepartment(session);
  if (scoped !== "All" && mat.department !== scoped) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ...mat, stockStatus: stockStatus(mat), noMovementDays: noMovementDays(mat) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Only Store Admin can edit materials" }, { status: 403 });
  }

  const { id } = await params;
  const existing = getMaterialById(id);
  if (!existing) return NextResponse.json({ error: "Material not found" }, { status: 404 });

  const body = await req.json();

  if (body.department !== undefined) {
    const matchedDept = DEPARTMENTS.find((d) => d.toLowerCase() === String(body.department).toLowerCase());
    if (!matchedDept) {
      return NextResponse.json({ error: `Invalid department. Must be one of: ${DEPARTMENTS.join(", ")}` }, { status: 400 });
    }
    body.department = matchedDept;
  }
  if (body.status !== undefined && !["Active", "Inactive"].includes(body.status)) {
    return NextResponse.json({ error: 'Status must be "Active" or "Inactive"' }, { status: 400 });
  }
  if (body.partNumber !== undefined) {
    const trimmed = String(body.partNumber).trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Part number cannot be empty" }, { status: 400 });
    }
    const clash = getMaterialByPartNumber(trimmed);
    if (clash && clash.id !== id) {
      return NextResponse.json({ error: `Part number "${trimmed}" is already used by another material` }, { status: 409 });
    }
    body.partNumber = trimmed;
  }
  for (const f of ["minStock", "maxStock", "currentStock", "unitValue"] as const) {
    if (body[f] !== undefined && body[f] !== "") {
      const n = Number(body[f]);
      if (Number.isNaN(n) || n < 0) {
        return NextResponse.json({ error: `${f} must be a non-negative number` }, { status: 400 });
      }
    }
  }

  const patch: Record<string, unknown> = {};
  for (const f of [
    "partNumber", "description", "category", "department", "unit", "location", "warehouse", "rack", "row", "shelf",
    "minStock", "maxStock", "currentStock", "unitValue", "status", "remarks", "supplier",
  ] as const) {
    if (body[f] !== undefined && body[f] !== "") {
      patch[f] = ["minStock", "maxStock", "currentStock", "unitValue"].includes(f) ? Number(body[f]) : body[f];
    }
  }

  const updated = updateMaterial(id, patch, session.username);
  logAudit(session.username, "MATERIAL_EDIT", existing.description, JSON.stringify(patch));

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Only Store Admin can delete materials" }, { status: 403 });
  }

  const { id } = await params;
  const existing = getMaterialById(id);
  if (!existing) return NextResponse.json({ error: "Material not found" }, { status: 404 });

  deleteMaterial(id);
  logAudit(session.username, "MATERIAL_DELETE", `${existing.partNumber} — ${existing.description}`, "-");

  return NextResponse.json({ ok: true });
}
