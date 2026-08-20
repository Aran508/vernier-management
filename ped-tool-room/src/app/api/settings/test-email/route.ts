import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { sendMail, SmtpConfigOverride, verifySmtp } from "@/lib/mailer";
import { listEmailLog } from "@/lib/db";
import { adminNotificationEmail } from "@/lib/emailTemplates";

/**
 * Lets a Store Admin verify SMTP actually works before relying on it — tests
 * whatever's currently typed in the Settings form (not just what's saved),
 * so a bad host/password can be caught before hitting Save.
 */
/** Recent send history, so mail problems are visible rather than guessed at. */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Only Store Admin can view the mail log" }, { status: 403 });
  }
  return NextResponse.json({ entries: listEmailLog(25) });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Only Store Admin can send a test email" }, { status: 403 });
  }

  const body = await req.json();
  const configOverride: SmtpConfigOverride = {
    host: body.smtpHost,
    port: body.smtpPort,
    secure: body.smtpSecure,
    user: body.smtpUser,
    pass: body.smtpPass,
    from: body.smtpFrom,
  };

  const to = body.smtpUser || body.smtpFrom;
  if (!to) {
    return NextResponse.json({ error: "Enter an email address first (Outlook Email Address field)" }, { status: 400 });
  }

  // Caught here rather than letting it become an opaque DNS error 30 seconds
  // later — an "@" in the host is always this mistake.
  const host = String(body.smtpHost || "").trim();
  if (host.includes("@")) {
    return NextResponse.json(
      {
        sent: false,
        error: `SMTP Host can't be an email address — "${host}" is who you send as, not the server that sends it. Use smtp.office365.com for Outlook/Microsoft 365 and keep your address in the Outlook Email Address field.`,
      },
      { status: 422 }
    );
  }

  // Check the connection and sign-in first: a credentials problem then reports
  // as a credentials problem, instead of surfacing as a generic send failure.
  if (host) {
    const check = await verifySmtp(configOverride);
    if (!check.ok) {
      return NextResponse.json({ sent: false, stage: "connection", error: check.reason }, { status: 422 });
    }
  }

  const result = await sendMail({
    to,
    subject: "PED Tool Room — Test Email",
    html: adminNotificationEmail({
      heading: "Test Email",
      message: `This confirms outgoing email is working. Sent by ${session.employeeName} to verify the SMTP configuration.`,
      details: { "Sent at": new Date().toLocaleString() },
    }),
    configOverride,
  });

  if (!result.sent) {
    return NextResponse.json({ sent: false, stage: "send", error: result.reason || "Failed to send test email" }, { status: 422 });
  }
  return NextResponse.json({ sent: true, to, transport: result.transport, note: result.reason });
}
