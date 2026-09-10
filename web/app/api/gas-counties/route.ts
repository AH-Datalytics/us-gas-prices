import { NextResponse } from "next/server";
import { cachedPrepare } from "@/lib/db";
import { getChangeDates } from "@/lib/queries";

const STATE_FIPS: Record<string, string> = {
  AL:"01",AK:"02",AZ:"04",AR:"05",CA:"06",CO:"08",CT:"09",DE:"10",
  DC:"11",FL:"12",GA:"13",HI:"15",ID:"16",IL:"17",IN:"18",IA:"19",
  KS:"20",KY:"21",LA:"22",ME:"23",MD:"24",MA:"25",MI:"26",MN:"27",
  MS:"28",MO:"29",MT:"30",NE:"31",NV:"32",NH:"33",NJ:"34",NM:"35",
  NY:"36",NC:"37",ND:"38",OH:"39",OK:"40",OR:"41",PA:"42",RI:"44",
  SC:"45",SD:"46",TN:"47",TX:"48",UT:"49",VT:"50",VA:"51",WA:"53",
  WV:"54",WI:"55",WY:"56",
};

/**
 * All county prices with FIPS codes for map colouring, plus 7- and 28-day
 * changes. Counties are scraped weekly, so 7 and 28 days back land exactly on
 * stored snapshots; `dates` reports which ones were actually used so the UI
 * can label the comparison honestly.
 */
export function GET() {
  const dates = getChangeDates("aaa_county_prices");

  const rows = cachedPrepare(
    `SELECT a.state, a.county, a.price,
            a.price - w.price AS chg7,
            a.price - m.price AS chg28
     FROM aaa_county_prices a
     LEFT JOIN aaa_county_prices w
       ON w.state = a.state AND w.county = a.county AND w.date = ?
     LEFT JOIN aaa_county_prices m
       ON m.state = a.state AND m.county = a.county AND m.date = ?
     WHERE a.date = ?`
  ).all(dates.d7 ?? "", dates.d28 ?? "", dates.anchor) as {
    state: string; county: string; price: number;
    chg7: number | null; chg28: number | null;
  }[];

  // Return state + county + values and let the client match by name
  const result = rows.map((r) => ({
    state: r.state,
    stateFips: STATE_FIPS[r.state] || "",
    county: r.county,
    price: r.price,
    chg7: r.chg7,
    chg28: r.chg28,
  }));

  return NextResponse.json({ counties: result, dates });
}
