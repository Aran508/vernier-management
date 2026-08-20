import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, scopedDepartment } from "@/lib/auth";
import { listInward, listMaterials, listOutward, noMovementDays, stockStatus } from "@/lib/db";
import { Department } from "@/lib/types";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scoped = scopedDepartment(session);
  const { searchParams } = new URL(req.url);
  const deptParam = searchParams.get("department") as Department | "All" | null;
  const department = scoped !== "All" ? (scoped as Department) : deptParam || "All";

  const materials = listMaterials({ department });
  const allInward = listInward({ department });
  const allOutward = listOutward({ department });

  const summary = materials.map((m) => {
    const totalInward = allInward
      .filter((i) => i.partNumber === m.partNumber)
      .reduce((sum, i) => sum + i.quantity, 0);
    const totalOutward = allOutward
      .filter((o) => o.partNumber === m.partNumber)
      .reduce((sum, o) => sum + o.quantity, 0);

    return {
      materialDescription: m.description,
      partNumber: m.partNumber,
      category: m.category,
      department: m.department,
      openingStock: m.openingStock,
      totalInward,
      totalOutward,
      closingStock: m.currentStock,
      minStock: m.minStock,
      maxStock: m.maxStock,
      currentStock: m.currentStock,
      location: m.location,
      rack: m.rack,
      row: m.row,
      shelf: m.shelf,
      lastInwardDate: m.lastInwardDate,
      lastOutwardDate: m.lastOutwardDate,
      noMovementDays: noMovementDays(m),
      inventoryValue: m.currentStock * m.unitValue,
      stockStatus: stockStatus(m),
    };
  });

  return NextResponse.json(summary);
}
