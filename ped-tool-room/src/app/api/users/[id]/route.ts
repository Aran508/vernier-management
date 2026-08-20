import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { countActiveAdmins, deleteUser, findUserByUsername, getUserById, logAudit, resetUserPassword, updateUser } from "@/lib/db";
import { DEPARTMENTS } from "@/lib/types";

const VALID_ROLES = ["STORE_ADMIN", "PROCESS_OWNER", "MONITORING"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (session.role !== "STORE_ADMIN" && id !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = getUserById(id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ ...user, passwordHash: undefined });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const isSelf = id === session.id;
  const isAdmin = session.role === "STORE_ADMIN";

  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "Only Store Admin can edit other users" }, { status: 403 });
  }

  const existing = getUserById(id);
  if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();

  // A non-admin editing their own account can only change their own contact
  // details — not their role, department, username, or status.
  const allowedFields = isAdmin
    ? (["employeeName", "department", "role", "email", "phone", "status", "username"] as const)
    : (["email", "phone"] as const);

  if (!isAdmin && (body.role || body.department || body.status || body.username)) {
    return NextResponse.json({ error: "You can only update your email and phone number." }, { status: 403 });
  }

  if (isAdmin && body.username !== undefined) {
    const trimmed = String(body.username).trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Username cannot be empty" }, { status: 400 });
    }
    const clash = findUserByUsername(trimmed);
    if (clash && clash.id !== id) {
      return NextResponse.json({ error: `Username "${trimmed}" is already taken` }, { status: 409 });
    }
    body.username = trimmed;
  }

  if (body.email !== undefined && body.email !== "" && !EMAIL_RE.test(body.email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (body.role !== undefined && !VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
  }
  if (body.department !== undefined && body.department !== "All" && !DEPARTMENTS.includes(body.department)) {
    return NextResponse.json({ error: `Invalid department. Must be "All" or one of: ${DEPARTMENTS.join(", ")}` }, { status: 400 });
  }
  if (body.status !== undefined && !["Active", "Inactive"].includes(body.status)) {
    return NextResponse.json({ error: 'Status must be "Active" or "Inactive"' }, { status: 400 });
  }

  // Guard: don't allow demoting or deactivating the last active Store Admin —
  // that would lock everyone out of admin functions.
  if (isAdmin) {
    const wouldLoseAdminStatus =
      existing.role === "STORE_ADMIN" &&
      ((body.role && body.role !== "STORE_ADMIN") || (body.status && body.status !== "Active"));
    if (wouldLoseAdminStatus && countActiveAdmins(existing.id) === 0) {
      return NextResponse.json(
        { error: "Cannot change this user — they are the last active Store Admin." },
        { status: 400 }
      );
    }
  }

  // Handle a password reset as its own action within this same endpoint.
  // Self-service users can reset their own password too (e.g. "change my password").
  if (body.newPassword) {
    if (String(body.newPassword).length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    resetUserPassword(id, body.newPassword);
    logAudit(session.username, isSelf ? "USER_PASSWORD_CHANGE_SELF" : "USER_PASSWORD_RESET", "-", `Password changed for ${existing.username}`);
  }

  const patch: Record<string, unknown> = {};
  for (const f of allowedFields) {
    if (body[f] !== undefined && body[f] !== "") patch[f] = body[f];
  }

  const updated = Object.keys(patch).length > 0 ? updateUser(id, patch) : existing;
  if (Object.keys(patch).length > 0) {
    logAudit(session.username, isSelf ? "USER_EDIT_SELF" : "USER_EDIT", existing.employeeName, JSON.stringify(patch));
  }

  return NextResponse.json({ ...updated, passwordHash: undefined });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Only Store Admin can delete users" }, { status: 403 });
  }

  const { id } = await params;
  const existing = getUserById(id);
  if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (existing.id === session.id) {
    return NextResponse.json({ error: "You cannot delete your own account while logged in as it." }, { status: 400 });
  }
  if (existing.role === "STORE_ADMIN" && countActiveAdmins(existing.id) === 0) {
    return NextResponse.json({ error: "Cannot delete the last active Store Admin." }, { status: 400 });
  }

  deleteUser(id);
  logAudit(session.username, "USER_DELETE", `${existing.username} (${existing.role})`, "-");

  return NextResponse.json({ ok: true });
}
