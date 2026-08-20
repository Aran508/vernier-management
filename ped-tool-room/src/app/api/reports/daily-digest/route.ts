import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { sendDailyDigest } from "@/lib/dailyDigest";
import { isSmtpConfigured } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Only Store Admin can trigger the daily digest" }, { status: 403 });
  }

  // Pressing the button is an explicit request, so it re-sends rather than
  // being silently suppressed by today's duplicate guard.
  const result = await sendDailyDigest({ force: true });
  return NextResponse.json({ ...result, smtpConfigured: isSmtpConfigured() });
}
