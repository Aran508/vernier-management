/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * We use it to schedule the daily stock-summary digest email.
 *
 * Only runs in the Node.js runtime (not Edge, where cron/nodemailer aren't
 * available) and guards against being scheduled twice during dev-mode hot
 * reloads.
 *
 * The send hour is configurable from Settings (admin, Dashboard → gear
 * icon) rather than hardcoded — this runs an hourly check and compares the
 * current hour against the configured setting, so changing it in the UI
 * takes effect without restarting the server.
 */

const globalForCron = globalThis as unknown as { __PED_DIGEST_SCHEDULED__?: boolean };

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalForCron.__PED_DIGEST_SCHEDULED__) return;
  globalForCron.__PED_DIGEST_SCHEDULED__ = true;

  const cron = await import("node-cron");
  const { sendDailyDigest } = await import("./lib/dailyDigest");
  const { getSettings, updateSettings } = await import("./lib/db");

  // Runs at the top of every hour; the handler itself decides whether it's
  // actually time to send, based on the configured hour and whether a
  // digest has already gone out today (guards against duplicate sends if
  // the server restarts more than once within the target hour).
  cron.schedule("0 * * * *", async () => {
    try {
      const settings = getSettings();
      if (settings.dailyDigestEnabled !== "true") return;

      const now = new Date();
      const targetHour = Number(settings.dailyDigestHour ?? "8");
      if (now.getHours() !== targetHour) return;

      const today = now.toISOString().slice(0, 10);
      if (settings.lastDigestSentDate === today) return;

      const result = await sendDailyDigest();
      updateSettings({ lastDigestSentDate: today });
      console.log(`[daily-digest] Sent ${result.sent}, skipped ${result.skipped}`);
    } catch (err) {
      console.error("[daily-digest] Failed:", err);
    }
  });

  console.log("[daily-digest] Hourly scheduler started (send hour is configurable in Settings).");
}
