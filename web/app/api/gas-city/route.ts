import { NextRequest, NextResponse } from "next/server";
import { getGasPrices } from "@/lib/queries";
import { daysAgo } from "@/lib/utils";

export function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") || "";
  const fuel = req.nextUrl.searchParams.get("fuel") || "regular_gas";
  const twoYearsAgo = daysAgo(730);

  const prices = getGasPrices("city", city, fuel, twoYearsAgo);

  return NextResponse.json({ prices });
}
