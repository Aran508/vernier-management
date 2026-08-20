import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, scopedDepartment } from "@/lib/auth";
import { listInward, listMaterials, listOutward } from "@/lib/db";
import { Department } from "@/lib/types";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scoped = scopedDepartment(session);
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").toLowerCase();
  const department = scoped !== "All" ? (scoped as Department) : "All";

  if (!q) return NextResponse.json({ materials: [], inward: [], outward: [] });

  const materials = listMaterials({ department, query: q }).slice(0, 8);
  const inward = listInward({ department })
    .filter(
      (i) =>
        i.partNumber.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.supplier.toLowerCase().includes(q) ||
        i.invoiceNumber.toLowerCase().includes(q)
    )
    .slice(0, 8);
  const outward = listOutward({ department })
    .filter(
      (o) =>
        o.partNumber.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        o.issuedTo.toLowerCase().includes(q)
    )
    .slice(0, 8);

  return NextResponse.json({ materials, inward, outward });
}
