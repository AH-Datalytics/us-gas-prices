import { NextRequest, NextResponse } from "next/server";
import { getStateEnergy } from "@/lib/queries";

const CONSUMPTION_SERIES = ["PAACB", "NGACB", "CLACB", "NUETB", "TEACB"];

export function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state") || "TX";
  const data = getStateEnergy(state, CONSUMPTION_SERIES);
  return NextResponse.json({ data });
}
