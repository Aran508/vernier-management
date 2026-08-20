import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, scopedDepartment } from "@/lib/auth";
import { listAuditLog, listInward, listMaterials, listOutward, stockStatus } from "@/lib/db";
import { Department } from "@/lib/types";

interface NotificationItem {
  id: string;
  type: "low-stock" | "out-of-stock" | "inward" | "outward" | "admin";
  title: string;
  detail: string;
  timestamp: string;
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scoped = scopedDepartment(session);
  const department = (scoped !== "All" ? scoped : "All") as Department | "All";

  const items: NotificationItem[] = [];

  // Low stock / out of stock alerts
  const materials = listMaterials({ department });
  for (const m of materials) {
    const status = stockStatus(m);
    if (status === "Low" || status === "Out of Stock") {
      items.push({
        id: `stock-${m.id}`,
        type: status === "Out of Stock" ? "out-of-stock" : "low-stock",
        title: status === "Out of Stock" ? "Out of stock" : "Low stock",
        detail: `${m.partNumber} — ${m.description} (${m.currentStock} ${m.unit} remaining, min ${m.minStock})`,
        timestamp: m.modifiedDate,
      });
    }
  }

  // Recent inward (last 5)
  const inward = listInward({ department }).slice(0, 5);
  for (const i of inward) {
    items.push({
      id: `inward-${i.id}`,
      type: "inward",
      title: "Material received",
      detail: `+${i.quantity} ${i.unit} of ${i.partNumber} — ${i.description} (${i.department})`,
      timestamp: i.createdAt,
    });
  }

  // Recent outward (last 5)
  const outward = listOutward({ department }).slice(0, 5);
  for (const o of outward) {
    items.push({
      id: `outward-${o.id}`,
      type: "outward",
      title: "Material issued",
      detail: `-${o.quantity} of ${o.partNumber} → ${o.issuedTo} (${o.department})`,
      timestamp: o.createdAt,
    });
  }

  // Recent admin actions (Store Admin / Monitoring only — audit log is already
  // restricted to these roles elsewhere in the app)
  if (session.role !== "PROCESS_OWNER") {
    const audit = listAuditLog()
      .filter((a) => !["LOGIN"].includes(a.action))
      .slice(0, 8);
    for (const a of audit) {
      items.push({
        id: `audit-${a.id}`,
        type: "admin",
        title: a.action.replace(/_/g, " "),
        detail: `${a.user} — ${a.newValue}`,
        timestamp: `${a.date}T${a.time}`,
      });
    }
  }

  // Sort newest first, cap to 20
  items.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return NextResponse.json({
    items: items.slice(0, 20),
    unreadCount: materials.filter((m) => stockStatus(m) === "Low" || stockStatus(m) === "Out of Stock").length,
  });
}
