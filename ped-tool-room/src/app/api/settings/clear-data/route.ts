import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { ClearableModule, clearModule, countModuleRows } from "@/lib/db";

const MODULES: ClearableModule[] = ["materials", "inward", "outward"];

/** Current row counts, so Settings can show what a Clear All would remove. */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Only Store Admin can view this" }, { status: 403 });
  }
  return NextResponse.json(countModuleRows());
}

/**
 * Empties one module. Store Admin only, and the caller has to name the module
 * *and* echo back its exact row count — a mis-click can't wipe a register,
 * because the count has to match what the client was actually shown.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Only Store Admin can clear data" }, { status: 403 });
  }

  const body = await req.json();
  const target = body.module as ClearableModule;
  if (!MODULES.includes(target)) {
    return NextResponse.json({ error: `Unknown module. Expected one of: ${MODULES.join(", ")}` }, { status: 400 });
  }

  const counts = countModuleRows();
  if (counts[target] === 0) {
    return NextResponse.json({ error: "Nothing to clear — that module is already empty." }, { status: 400 });
  }
  // Guards against a stale page clearing more than the admin saw.
  if (Number(body.confirmCount) !== counts[target]) {
    return NextResponse.json(
      {
        error: `Row count doesn't match (you confirmed ${body.confirmCount}, there are now ${counts[target]}). Reopen Settings and try again.`,
      },
      { status: 409 }
    );
  }

  const result = clearModule(target, session.username);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });

  return NextResponse.json({
    cleared: target,
    deleted: result.deleted,
    backupPath: result.backupPath,
    remaining: countModuleRows(),
  });
}
