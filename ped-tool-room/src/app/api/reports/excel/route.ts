import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSessionFromRequest, scopedDepartment } from "@/lib/auth";
import { REPORT_BUILDERS } from "@/lib/reportData";
import { buildReportWorkbook } from "@/lib/excel/buildReportWorkbook";
import { Department } from "@/lib/types";

let cachedLogo: Buffer | null = null;
function getLogoBuffer(): Buffer | undefined {
  if (cachedLogo) return cachedLogo;
  try {
    const filePath = path.join(process.cwd(), "public", "wipro-logo.jpg");
    cachedLogo = fs.readFileSync(filePath);
    return cachedLogo;
  } catch {
    return undefined;
  }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "";
  const scope = searchParams.get("scope") === "filtered" ? "filtered" : "all";
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const statusFilter = searchParams.get("status") || "All";
  const deptParam = searchParams.get("department") as Department | "All" | null;

  const builder = REPORT_BUILDERS[type];
  if (!builder) {
    return NextResponse.json({ error: `Unknown report type: ${type}` }, { status: 400 });
  }

  // Department resolution always respects RBAC — a Process Owner can never
  // export outside their own department, regardless of query params.
  const scoped = scopedDepartment(session);
  const effectiveDepartment = scoped !== "All" ? scoped : deptParam || "All";

  const report = builder(effectiveDepartment as Department | "All");

  let rows = report.rows;
  if (scope === "filtered") {
    if (q) {
      rows = rows.filter((row) =>
        Object.values(row).some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (type === "stock-summary" && statusFilter !== "All") {
      rows = rows.filter((row) => row.status === statusFilter);
    }
  }

  const filterParts = [
    `Department: ${effectiveDepartment === "All" ? "All Departments" : effectiveDepartment}`,
    scope === "filtered" ? "Scope: Filtered view" : "Scope: Entire dataset",
  ];
  if (scope === "filtered" && q) filterParts.push(`Search: "${q}"`);
  if (scope === "filtered" && type === "stock-summary" && statusFilter !== "All") {
    filterParts.push(`Status: ${statusFilter}`);
  }

  const wb = await buildReportWorkbook({
    title: report.title,
    columns: report.columns,
    rows,
    logoBuffer: getLogoBuffer(),
    filterSummary: filterParts.join("  ·  "),
    generatedBy: `${session.employeeName} (${session.role.replace("_", " ")})`,
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `${report.title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
