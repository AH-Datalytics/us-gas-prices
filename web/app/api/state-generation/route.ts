import { NextRequest, NextResponse } from "next/server";
import { getStateGeneration } from "@/lib/queries";

export function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state") || "TX";
  const start = req.nextUrl.searchParams.get("start") || "2020-01";
  const end = req.nextUrl.searchParams.get("end") || "2026-12";

  const data = getStateGeneration(state, start, end);
  return NextResponse.json({ data });
}
