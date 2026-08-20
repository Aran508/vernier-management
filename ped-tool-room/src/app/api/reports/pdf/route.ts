import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { getSessionFromRequest, scopedDepartment } from "@/lib/auth";
import { REPORT_BUILDERS } from "@/lib/reportData";
import { ReportDocument } from "@/lib/pdf/ReportDocument";
import { Department } from "@/lib/types";

let cachedLogo: string | null = null;
function getLogoDataUri(): string | undefined {
  if (cachedLogo) return cachedLogo;
  try {
    const filePath = path.join(process.cwd(), "public", "wipro-logo.jpg");
    const bytes = fs.readFileSync(filePath);
    cachedLogo = `data:image/jpeg;base64,${bytes.toString("base64")}`;
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

  // "Filtered" export applies the same search text / status chip the user
  // currently has active in the table; "all" ignores those and exports every
  // record the user's role is allowed to see for the resolved department.
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

  const doc = React.createElement(ReportDocument, {
    title: report.title,
    columns: report.columns,
    rows,
    logoBase64: getLogoDataUri(),
    filterSummary: filterParts.join("  ·  "),
    generatedBy: `${session.employeeName} (${session.role.replace("_", " ")})`,
  });

  const buffer = await renderToBuffer(doc);
  const filename = `${report.title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
