import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { Role } from "./types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ped-tool-room-dev-secret-change-me"
);
export const AUTH_COOKIE = "ped_session";

export interface SessionPayload {
  id: string;
  username: string;
  employeeName: string;
  role: Role;
  department: string;
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(JWT_SECRET);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Department scoping: Process Owners are restricted to their own department. */
export function scopedDepartment(session: SessionPayload): string | "All" {
  if (session.role === "PROCESS_OWNER") return session.department;
  return "All";
}

export function canWrite(session: SessionPayload) {
  return session.role === "STORE_ADMIN";
}

/**
 * Inward/Outward transaction access: Store Admin and Monitoring can transact
 * for any department; a Process Owner can only transact for their own
 * department. (Material Master create/edit remains Store Admin only.)
 */
export function canTransactForDepartment(session: SessionPayload, department: string) {
  if (session.role === "PROCESS_OWNER") return session.department === department;
  return true; // STORE_ADMIN and MONITORING can transact for any department
}

/** Inward/Outward entry rights: Store Admin (all depts) + Process Owners (own dept only). Monitoring stays read-only. */
export function canManageTransactions(session: SessionPayload) {
  return session.role === "STORE_ADMIN" || session.role === "PROCESS_OWNER";
}
