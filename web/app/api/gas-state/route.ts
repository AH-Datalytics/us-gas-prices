import { NextRequest, NextResponse } from "next/server";
import { getGasPrices, getCitiesForState, getAaaCountyPrices } from "@/lib/queries";
import { daysAgo } from "@/lib/utils";
import { cachedPrepare } from "@/lib/db";

export function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state") || "";
  const fuel = req.nextUrl.searchParams.get("fuel") || "regular_gas";
  const twoYearsAgo = daysAgo(730);

  const prices = getGasPrices("state", state, fuel, twoYearsAgo);
  const eiaCity = getCitiesForState(state, fuel);
  const counties = getAaaCountyPrices(state);

  // Get available cities for this state from EIA data
  let cities: { area_id: string; area_name: string }[] = [];
  try {
    cities = cachedPrepare(
      "SELECT DISTINCT area_id, area_name FROM gas_prices WHERE area_type = 'city' AND area_id LIKE ? ORDER BY area_name"
    ).all(`%${state}%`) as { area_id: string; area_name: string }[];
    // Also include all known cities if state-specific ones are empty
    if (cities.length === 0) {
      cities = cachedPrepare(
        "SELECT DISTINCT area_id, area_name FROM gas_prices WHERE area_type = 'city' ORDER BY area_name"
      ).all() as { area_id: string; area_name: string }[];
    }
  } catch {}

  return NextResponse.json({ prices, cities, counties });
}
