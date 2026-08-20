import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import { alreadySentToday, dedupeEmails, getSettings, recordEmail } from "./db";

/**
 * SMTP configuration lives in the database (Settings → System Settings,
 * admin-only) so nobody has to hand-edit .env.local. Environment variables
 * are still supported as a fallback/initial-setup convenience — if a field
 * isn't set in the database, the matching env var is used instead.
 *
 * If neither is configured, sendMail() logs the message instead of
 * throwing — so the rest of the app (inward/outward/material flows) never
 * breaks because email isn't set up yet.
 */

interface MailPayload {
  to: string | string[];
  subject: string;
  html: string;
  configOverride?: SmtpConfigOverride;
  /**
   * Identity for "don't send this same thing twice today", e.g.
   * `low-stock:44FT-0001`. Omit for messages that should always send, like a
   * per-transaction confirmation.
   */
  dedupeKey?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/** Same shape as the Settings form — used so "Send Test Email" can verify
 *  whatever's currently typed in the form, not just what's already saved. */
export interface SmtpConfigOverride {
  host?: string;
  port?: string | number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

function resolveSmtpConfig(overrides?: SmtpConfigOverride): SmtpConfig | null {
  const settings = getSettings();

  const host = overrides?.host || settings.smtpHost || process.env.SMTP_HOST || "";
  const port = Number(overrides?.port || settings.smtpPort || process.env.SMTP_PORT || "587");
  const secure = overrides?.secure ?? (settings.smtpSecure || process.env.SMTP_SECURE || "false") === "true";
  const user = overrides?.user || settings.smtpUser || process.env.SMTP_USER || "";
  // A blank override password means "use whatever's already saved" (the
  // Settings form never pre-fills the real password) — not "no password".
  const pass = overrides?.pass || settings.smtpPass || process.env.SMTP_PASS || "";
  const from = overrides?.from || settings.smtpFrom || process.env.SMTP_FROM || user;

  if (!host || !user || !pass) return null;
  return { host, port, secure, user, pass, from };
}

export function isSmtpConfigured(): boolean {
  return resolveSmtpConfig() !== null;
}

/**
 * Turns nodemailer/Node socket errors into something an admin can act on.
 * The raw text ("getaddrinfo EAI_FAIL user@company.com") says nothing about
 * what to change — and the most common mistake by far is typing an email
 * address into the SMTP Host box, which surfaces as a DNS failure.
 */
export function describeSmtpError(err: unknown, host: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string } | null)?.code ?? "";
  const dnsFailed = code === "EAI_FAIL" || code === "ENOTFOUND" || /EAI_FAIL|ENOTFOUND/.test(raw);

  if (dnsFailed && host.includes("@")) {
    return `SMTP Host can't be an email address — "${host}" is who you send as, not the server that sends it. Put the mail server there instead, usually smtp.office365.com (use the "Use Outlook defaults" link above), and keep your address in the Outlook Email Address field.`;
  }
  if (dnsFailed) {
    return `Couldn't find a mail server called "${host}". Check the spelling, or use smtp.office365.com for Outlook/Microsoft 365.`;
  }
  if (code === "ETIMEDOUT" || code === "ECONNREFUSED" || /ETIMEDOUT|ECONNREFUSED/.test(raw)) {
    return `Reached the network but "${host}" didn't accept a connection on this port. Port 587 with Secure off, or 465 with Secure on, are the usual combinations — a company firewall can also block outbound SMTP.`;
  }
  if (code === "EAUTH" || /535|５35|authenticate|Authentication unsuccessful/i.test(raw)) {
    if (/SmtpClientAuthentication is disabled/i.test(raw)) {
      return `Microsoft is refusing SMTP sign-in for this mailbox because the organisation has SMTP AUTH turned off. Nothing in these settings can override that — ask IT to enable SMTP AUTH for this mailbox, or give you an internal relay host instead. (Server said: ${raw})`;
    }
    if (/outlook|hotmail|live|office365/i.test(host)) {
      return `Microsoft rejected the sign-in. Personal Outlook/Hotmail accounts no longer accept an ordinary account password over SMTP — they need either an app password (which requires two-step verification on the account) or OAuth. A work Microsoft 365 mailbox additionally needs SMTP AUTH enabled by IT. (Server said: ${raw})`;
    }
    if (/gmail|google/i.test(host)) {
      return `Google rejected the sign-in. Gmail requires a 16-character App Password, not your normal account password — generate one under Google Account → Security → App passwords (two-step verification must be on). (Server said: ${raw})`;
    }
    return `The server rejected the sign-in. Check the username and password, and whether this mailbox is allowed to send over SMTP at all. (Server said: ${raw})`;
  }
  if (/self.signed|unable to verify|certificate/i.test(raw)) {
    return `The mail server's security certificate couldn't be verified. This usually means an internal relay — check the host name with your IT team. (Server said: ${raw})`;
  }
  return raw;
}

/**
 * Writes the message to `data/outbox/` as a viewable .html file.
 *
 * This is what makes the feature usable with no SMTP at all: every
 * notification still gets produced and can be opened and checked, and no
 * caller ever sees an error just because mail isn't configured yet.
 */
function writeToOutbox(subject: string, recipients: string[], html: string): string {
  const dir = path.join(process.cwd(), "data", "outbox");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const slug = subject.replace(/[^a-z0-9]+/gi, "-").slice(0, 60).toLowerCase();
  const file = path.join(dir, `${stamp}-${slug}.html`);
  const header = `<!-- To: ${recipients.join(", ")} | Subject: ${subject} | ${new Date().toLocaleString()} -->\n`;
  fs.writeFileSync(file, header + html, "utf8");
  return path.relative(process.cwd(), file);
}

export async function sendMail({
  to,
  subject,
  html,
  configOverride,
  dedupeKey,
}: MailPayload): Promise<{ sent: boolean; reason?: string; transport?: "smtp" | "outbox"; skipped?: boolean }> {
  const recipients = dedupeEmails(Array.isArray(to) ? to : [to]);
  if (recipients.length === 0) {
    recordEmail({ dedupeKey, recipients: [], subject, status: "skipped", detail: "No recipients with an email address" });
    return { sent: false, reason: "No recipients" };
  }

  // Suppress a repeat of the same notification on the same day.
  if (dedupeKey && alreadySentToday(dedupeKey)) {
    recordEmail({ dedupeKey, recipients, subject, status: "skipped", detail: "Already sent today (duplicate suppressed)" });
    return { sent: false, skipped: true, reason: "Already sent today" };
  }

  const config = resolveSmtpConfig(configOverride);

  // No SMTP yet: still produce the message, on disk, and report success so
  // inward/outward/material flows are never blocked by mail setup.
  if (!config) {
    try {
      const file = writeToOutbox(subject, recipients, html);
      recordEmail({ dedupeKey, recipients, subject, status: "outbox", detail: file, transport: "outbox" });
      console.log(`[mailer] SMTP not configured — wrote "${subject}" to ${file}`);
      return { sent: true, transport: "outbox", reason: `SMTP not configured — saved to ${file}` };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Could not write to outbox";
      recordEmail({ dedupeKey, recipients, subject, status: "failed", detail: reason });
      return { sent: false, reason };
    }
  }

  try {
    // Created fresh each send (cheap) rather than cached, since the admin
    // can change SMTP settings at any time from the Settings panel and we
    // always want the current configuration, not a stale cached one.
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

    await transporter.sendMail({
      from: config.from,
      to: recipients.join(","),
      subject,
      html,
    });
    recordEmail({ dedupeKey, recipients, subject, status: "sent", transport: "smtp", detail: config.host });
    return { sent: true, transport: "smtp" };
  } catch (err) {
    console.error("[mailer] Failed to send email:", err);
    const reason = describeSmtpError(err, config.host);
    // Keep the message rather than losing it, so nothing is silently dropped
    // when the mail server rejects or times out.
    let detail = reason;
    try {
      detail = `${reason} | preserved at ${writeToOutbox(subject, recipients, html)}`;
    } catch {
      // Outbox unavailable too — the logged reason still records the failure.
    }
    recordEmail({ dedupeKey, recipients, subject, status: "failed", transport: "smtp", detail });
    return { sent: false, reason };
  }
}

/**
 * Opens a connection and authenticates without sending anything, so setup can
 * be checked separately from composing a message.
 */
export async function verifySmtp(
  configOverride?: SmtpConfigOverride
): Promise<{ ok: boolean; reason?: string }> {
  const config = resolveSmtpConfig(configOverride);
  if (!config) return { ok: false, reason: "Fill in Host, Email Address and Password first." };
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
    });
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: describeSmtpError(err, config.host) };
  }
}
