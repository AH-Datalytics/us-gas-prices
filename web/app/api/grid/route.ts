import { NextRequest, NextResponse } from "next/server";
import { getGridDemand, getGridFuel } from "@/lib/queries";

export function GET(req: NextRequest) {
  const ba = req.nextUrl.searchParams.get("ba") || "ERCO";
  const start = req.nextUrl.searchParams.get("start") || "";
  const end = req.nextUrl.searchParams.get("end") || "";

  const demand = getGridDemand(ba, start, end);
  const fuel = getGridFuel(ba, start, end);

  return NextResponse.json({ demand, fuel });
}
