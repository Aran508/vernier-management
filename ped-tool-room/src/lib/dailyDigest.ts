import { listInward, listMaterials, listOutward, listUsers, noMovementDays, stockStatus } from "./db";
import { sendMail } from "./mailer";
import { dailyDigestEmail } from "./emailTemplates";
import { Department } from "./types";

function buildDigestForScope(scopeName: string, department: Department | "All") {
  const materials = listMaterials({ department });
  const today = new Date().toISOString().slice(0, 10);
  const inward = listInward({ department });
  const outward = listOutward({ department });

  const lowStock = materials.filter((m) => stockStatus(m) === "Low" || stockStatus(m) === "Out of Stock");
  const overStock = materials.filter((m) => stockStatus(m) === "Over Stock");
  const noMovement = materials.filter((m) => (noMovementDays(m) ?? 0) >= 30);

  return dailyDigestEmail({
    scopeName,
    date: new Date(today).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),
    totalMaterials: materials.length,
    totalStockQuantity: materials.reduce((s, m) => s + m.currentStock, 0),
    inventoryValue: materials.reduce((s, m) => s + m.currentStock * m.unitValue, 0),
    lowStockCount: lowStock.length,
    overStockCount: overStock.length,
    noMovementCount: noMovement.length,
    todaysInward: inward.filter((i) => i.date === today).length,
    todaysOutward: outward.filter((o) => o.date === today).length,
    lowStockItems: lowStock.map((m) => ({
      partNumber: m.partNumber,
      description: m.description,
      currentStock: m.currentStock,
      minStock: m.minStock,
      unit: m.unit,
    })),
  });
}

/**
 * Sends the daily digest to every active user:
 * - Store Admin & Monitoring get a full "All Departments" digest.
 * - Each Process Owner gets a digest scoped to just their own department.
 * Safe to call manually (e.g. from an API route for testing) or from the
 * scheduled cron job in instrumentation.ts.
 */
export async function sendDailyDigest(
  /** `force: true` re-sends even if today's digest already went out — used by
   *  the manual "send now" button. The scheduled run leaves it off, so a cron
   *  firing twice in an hour can't mail everybody twice. */
  options: { force?: boolean } = {}
): Promise<{ sent: number; skipped: number; duplicates: number; noEmail: number }> {
  const users = listUsers().filter((u) => u.status === "Active");
  let sent = 0;
  let skipped = 0;
  let duplicates = 0;
  let noEmail = 0;

  for (const user of users) {
    if (!user.email) {
      noEmail++;
      skipped++;
      continue;
    }
    const isDeptScoped = user.role === "PROCESS_OWNER";
    const scopeName = isDeptScoped ? user.department : "All Departments";
    const department = isDeptScoped ? (user.department as Department) : "All";

    const html = buildDigestForScope(scopeName, department);
    const result = await sendMail({
      to: user.email,
      subject: `Daily Stock Summary — ${scopeName} — ${new Date().toLocaleDateString()}`,
      html,
      dedupeKey: options.force ? undefined : `digest:${user.id}`,
    });
    if (result.sent) sent++;
    else {
      skipped++;
      if (result.skipped) duplicates++;
    }
  }

  return { sent, skipped, duplicates, noEmail };
}
