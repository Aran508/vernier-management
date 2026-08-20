import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getSupplierDetail } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await params;
  return NextResponse.json(getSupplierDetail(decodeURIComponent(name)));
}
