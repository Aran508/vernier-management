import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getBudgetOverview, setMonthlyBudget } from "@/lib/db";

const MONTH_RE = /^\d{4}-\d{2}$/;

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : new Date().toISOString().slice(0, 7);

  return NextResponse.json(getBudgetOverview(month));
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "STORE_ADMIN") {
    return NextResponse.json({ error: "Only Store Admin can set the monthly budget" }, { status: 403 });
  }

  const body = await req.json();
  const { month, amount } = body as { month?: string; amount?: number };

  if (!month || !MONTH_RE.test(month)) {
    return NextResponse.json({ error: "Month must be in YYYY-MM format" }, { status: 400 });
  }
  const amountNum = Number(amount);
  if (Number.isNaN(amountNum) || amountNum < 0) {
    return NextResponse.json({ error: "Budget amount must be a non-negative number" }, { status: 400 });
  }

  setMonthlyBudget(month, amountNum, session.username);
  return NextResponse.json(getBudgetOverview(month));
}
