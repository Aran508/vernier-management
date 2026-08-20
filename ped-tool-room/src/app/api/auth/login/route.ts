import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByUsername, logAudit, touchLastLogin } from "@/lib/db";
import { AUTH_COOKIE, signSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

  // Basic brute-force protection: 10 attempts per IP per 15 minutes.
  const rl = checkRateLimit(`login:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { username, password } = (body ?? {}) as { username?: unknown; password?: unknown };

  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const user = findUserByUsername(username);
  if (!user || user.status !== "Active" || !bcrypt.compareSync(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = await signSession({
    id: user.id,
    username: user.username,
    employeeName: user.employeeName,
    role: user.role,
    department: user.department,
  });

  touchLastLogin(user.id);
  logAudit(user.username, "LOGIN", "-", "User logged in", ip);

  const res = NextResponse.json({
    id: user.id,
    username: user.username,
    employeeName: user.employeeName,
    role: user.role,
    department: user.department,
  });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Enable this once the app is served over HTTPS (see DEPLOYMENT.md) —
    // left configurable since many internal-network deployments run plain
    // HTTP, where a `secure` cookie would silently prevent login.
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
