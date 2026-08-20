import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, scopedDepartment } from "@/lib/auth";
import { DEPARTMENTS, listInward, listMaterials, listOutward, noMovementDays, stockStatus } from "@/lib/db";
import { Department } from "@/lib/types";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scoped = scopedDepartment(session);
  const { searchParams } = new URL(req.url);
  const deptParam = searchParams.get("department") as Department | "All" | null;
  const department = scoped !== "All" ? (scoped as Department) : deptParam || "All";
  const period = (searchParams.get("period") || "all") as "today" | "month" | "all" | "date";
  const specificDate = searchParams.get("date"); // YYYY-MM-DD, used when period === "date"

  const materials = listMaterials({ department });
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7); // YYYY-MM

  function inPeriod(dateStr: string) {
    if (period === "today") return dateStr === today;
    if (period === "month") return dateStr.slice(0, 7) === currentMonth;
    if (period === "date" && specificDate) return dateStr === specificDate;
    return true; // "all"
  }

  const inward = listInward({ department }).filter((i) => inPeriod(i.date));
  const outward = listOutward({ department }).filter((o) => inPeriod(o.date));

  const lowStock = materials.filter((m) => stockStatus(m) === "Low" || stockStatus(m) === "Out of Stock");
  const overStock = materials.filter((m) => stockStatus(m) === "Over Stock");
  const noMovement = materials.filter((m) => (noMovementDays(m) ?? 0) >= 30);

  const totalInwardQty = inward.reduce((s, i) => s + i.quantity, 0);
  const totalOutwardQty = outward.reduce((s, o) => s + o.quantity, 0);
  const todaysInward = inward.filter((i) => i.date === today);
  const todaysOutward = outward.filter((o) => o.date === today);

  const inventoryValue = materials.reduce((s, m) => s + m.currentStock * m.unitValue, 0);
  const totalInwardValue = inward.reduce((s, i) => {
    const mat = materials.find((m) => m.partNumber === i.partNumber);
    return s + i.quantity * (mat?.unitValue || 0);
  }, 0);

  const stockByDepartment = DEPARTMENTS.map((d) => ({
    department: d,
    stock: listMaterials({ department: d }).reduce((s, m) => s + m.currentStock, 0),
  }));

  const categoryMap = new Map<string, number>();
  materials.forEach((m) => categoryMap.set(m.category, (categoryMap.get(m.category) || 0) + m.currentStock));
  const categoryDistribution = Array.from(categoryMap.entries()).map(([category, qty]) => ({ category, qty }));

  const topIssued = [...outward]
    .reduce((acc: Record<string, number>, o) => {
      acc[o.description] = (acc[o.description] || 0) + o.quantity;
      return acc;
    }, {});
  const topIssuedMaterials = Object.entries(topIssued)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([description, qty]) => ({ description, qty }));

  // simple month bucket for monthly inward/outward (demo data has just current month)
  const monthLabel = new Date().toLocaleString("default", { month: "short" });
  const monthlyInward = [{ month: monthLabel, qty: totalInwardQty }];
  const monthlyOutward = [{ month: monthLabel, qty: totalOutwardQty }];

  return NextResponse.json({
    cards: {
      totalMaterials: materials.length,
      totalStockQuantity: materials.reduce((s, m) => s + m.currentStock, 0),
      lowStockItems: lowStock.length,
      excessStock: overStock.length,
      noMovementItems: noMovement.length,
      todaysOutward: todaysOutward.length,
      todaysInward: todaysInward.length,
      totalInwardQuantity: totalInwardQty,
      totalInwardValue,
      totalOutwardQuantity: totalOutwardQty,
      inventoryValue,
      activeLocations: new Set(materials.map((m) => m.location)).size,
      departments: DEPARTMENTS.length,
    },
    charts: {
      monthlyInward,
      monthlyOutward,
      stockByDepartment,
      categoryDistribution,
      topIssuedMaterials,
    },
    recent: {
      recentIssues: (period === "date" || period === "today") ? outward.slice(0, 50) : outward.slice(0, 5),
      recentInward: (period === "date" || period === "today") ? inward.slice(0, 50) : inward.slice(0, 5),
    },
    alerts: {
      lowStock: lowStock.slice(0, 8).map((m) => ({ partNumber: m.partNumber, description: m.description, currentStock: m.currentStock, minStock: m.minStock })),
      overStock: overStock.slice(0, 8).map((m) => ({ partNumber: m.partNumber, description: m.description, currentStock: m.currentStock, maxStock: m.maxStock })),
      noMovement: noMovement.slice(0, 8).map((m) => ({ partNumber: m.partNumber, description: m.description, days: noMovementDays(m) })),
    },
  });
}
