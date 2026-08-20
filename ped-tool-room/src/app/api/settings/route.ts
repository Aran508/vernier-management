import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getSettings, logAudit, updateSettings } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = getSettings();
  // Never send the SMTP password back to the browser, even to Store Admin —
  // once set, the UI just shows a placeholder and a "configured" flag.
  return NextResponse.json({
    ...settings,
    smtpPass: "",
    smtpPassSet: Boolean(settings.smtpPass),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Only Store Admin can change system settings" }, { status: 403 });
  }

  const body = await req.json();
  const patch: Record<string, string> = {};

  if (body.companyName !== undefined) patch.companyName = String(body.companyName).trim() || "PED Tool Room";
  if (body.companyTagline !== undefined) patch.companyTagline = String(body.companyTagline).trim();
  if (body.lowStockAlertsEnabled !== undefined) patch.lowStockAlertsEnabled = body.lowStockAlertsEnabled ? "true" : "false";
  if (body.dailyDigestEnabled !== undefined) patch.dailyDigestEnabled = body.dailyDigestEnabled ? "true" : "false";
  if (body.dailyDigestHour !== undefined) {
    const hour = Number(body.dailyDigestHour);
    if (Number.isNaN(hour) || hour < 0 || hour > 23) {
      return NextResponse.json({ error: "Daily digest hour must be between 0 and 23" }, { status: 400 });
    }
    patch.dailyDigestHour = String(hour);
  }

  // SMTP fields — a blank smtpPass means "leave the existing password
  // unchanged" (the field is never pre-filled with the real value, so an
  // empty submit is never an intentional "clear the password").
  if (body.smtpHost !== undefined) patch.smtpHost = String(body.smtpHost).trim();
  if (body.smtpPort !== undefined) {
    const port = Number(body.smtpPort);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      return NextResponse.json({ error: "SMTP port must be a valid port number" }, { status: 400 });
    }
    patch.smtpPort = String(port);
  }
  if (body.smtpSecure !== undefined) patch.smtpSecure = body.smtpSecure ? "true" : "false";
  if (body.smtpUser !== undefined) patch.smtpUser = String(body.smtpUser).trim();
  if (body.smtpFrom !== undefined) patch.smtpFrom = String(body.smtpFrom).trim();
  if (body.smtpPass) patch.smtpPass = String(body.smtpPass);

  const updated = updateSettings(patch);
  logAudit(session.username, "SETTINGS_UPDATE", "-", JSON.stringify({ ...patch, smtpPass: patch.smtpPass ? "(changed)" : undefined }));

  return NextResponse.json({ ...updated, smtpPass: "", smtpPassSet: Boolean(updated.smtpPass) });
}
