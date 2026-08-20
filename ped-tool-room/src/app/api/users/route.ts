import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionFromRequest } from "@/lib/auth";
import { createUser, findUserByUsername, listUsers, logAudit } from "@/lib/db";
import { DEPARTMENTS } from "@/lib/types";

const VALID_ROLES = ["STORE_ADMIN", "PROCESS_OWNER", "MONITORING"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = listUsers().map((u) => ({ ...u, passwordHash: undefined }));
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Only Store Admin can create users" }, { status: 403 });
  }
  const body = await req.json();
  const required = ["employeeId", "employeeName", "department", "role", "username", "password", "email"];
  for (const f of required) {
    if (!body[f]) return NextResponse.json({ error: `Missing field: ${f}` }, { status: 400 });
  }

  if (!VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
  }
  if (body.role === "PROCESS_OWNER" && !DEPARTMENTS.includes(body.department)) {
    return NextResponse.json({ error: `Invalid department. Must be one of: ${DEPARTMENTS.join(", ")}` }, { status: 400 });
  }
  if (!EMAIL_RE.test(body.email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (String(body.password).length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  if (findUserByUsername(body.username)) {
    return NextResponse.json({ error: `Username "${body.username}" is already taken` }, { status: 409 });
  }

  const created = createUser({
    employeeId: body.employeeId,
    employeeName: body.employeeName,
    department: body.role === "PROCESS_OWNER" ? body.department : "All",
    role: body.role,
    username: body.username,
    passwordHash: bcrypt.hashSync(body.password, 8),
    email: body.email,
    phone: body.phone || "-",
    status: "Active",
  });

  logAudit(session.username, "USER_CREATE", "-", `Created user ${created.username} (${created.role})`);

  return NextResponse.json({ ...created, passwordHash: undefined }, { status: 201 });
}
