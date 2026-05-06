"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import ChartCard from "@/components/ChartCard";
import ScopeToggle from "@/components/ScopeToggle";
import type { GasPriceRow, SteoRow } from "@/lib/queries";
import { fmtDollars, fmtMonth } from "@/lib/utils";

interface Props {
  nationalRegular: GasPriceRow[];
  nationalDiesel: GasPriceRow[];
  latestByState: GasPriceRow[];
  steoGas: SteoRow[];
  steoDiesel: SteoRow[];
}

export default function GasPricesClient({
  nationalRegular, nationalDiesel, latestByState, steoGas, steoDiesel,
}: Props) {
  const [fuel, setFuel] = useState<"regular_gas" | "diesel">("regular_gas");
  const [showForecast, setShowForecast] = useState(false);

  const priceData = fuel === "regular_gas" ? nationalRegular : nationalDiesel;
  const steoData = fuel === "regular_gas" ? steoGas : steoDiesel;

  // Build chart data: actual prices + optional forecast
  const chartData: { period: string; price: number | null; forecast: number | null }[] = priceData.map((r) => ({
    period: r.period,
    price: r.price,
    forecast: null,
  }));

  if (showForecast && steoData.length > 0) {
    const lastActual = priceData[priceData.length - 1]?.period || "";
    // Bridge point
    const bridgeIdx = chartData.findIndex((d) => d.period === lastActual);
    if (bridgeIdx >= 0) {
      chartData[bridgeIdx].forecast = chartData[bridgeIdx].price;
    }
    for (const row of steoData) {
      if (row.period > lastActual) {
        chartData.push({ period: row.period, price: null, forecast: row.value });
      }
    }
  }

  const latestNational = priceData[priceData.length - 1];
  const sortedStates = [...latestByState];

  return (
    <div className="max-w-6xl mx-auto px-8 py-6">
      <Link href="/" className="back-link mb-4">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back
      </Link>

      <div className="flex items-center justify-between mb-6 mt-2">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--blue-dark)", fontFamily: "var(--font-display)" }}>
          Gas Prices
        </h1>
        <div className="flex items-center gap-3">
          <ScopeToggle
            options={[
              { value: "regular_gas", label: "Regular Gasoline" },
              { value: "diesel", label: "Diesel" },
            ]}
            active={fuel}
            onChange={(v) => setFuel(v as "regular_gas" | "diesel")}
          />
          <button
            className={`forecast-btn ${showForecast ? "active" : ""}`}
            onClick={() => setShowForecast(!showForecast)}
          >
            {showForecast ? "Hide" : "Show"} Forecast
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="stat-box">
          <div className="stat-label">National Average</div>
          <div className="stat-value">{latestNational ? fmtDollars(latestNational.price) : "\u2014"}</div>
          <div className="stat-sub">per gallon &middot; {latestNational?.period || ""}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Highest State</div>
          <div className="stat-value">{sortedStates[0] ? fmtDollars(sortedStates[0].price) : "\u2014"}</div>
          <div className="stat-sub">{sortedStates[0]?.area_name || ""}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Lowest State</div>
          <div className="stat-value">{sortedStates.length > 0 ? fmtDollars(sortedStates[sortedStates.length - 1].price) : "\u2014"}</div>
          <div className="stat-sub">{sortedStates[sortedStates.length - 1]?.area_name || ""}</div>
        </div>
      </div>

      {/* National trend chart */}
      <ChartCard
        title={`U.S. ${fuel === "regular_gas" ? "Regular Gasoline" : "Diesel"} Prices`}
        subtitle="Weekly average, dollars per gallon"
        source="EIA Gasoline and Diesel Fuel Update + Short-Term Energy Outlook"
      >
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd8ce" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11, fill: "#5a6a7a" }}
              tickLine={false}
              axisLine={{ stroke: "#ddd8ce" }}
              interval={Math.max(Math.floor(chartData.length / 12) - 1, 0)}
              tickFormatter={(v: string) => {
                const parts = v.split("-");
                if (parts.length >= 2) return fmtMonth(`${parts[0]}-${parts[1]}`);
                return v;
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#5a6a7a" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#fff", border: "1px solid #ddd8ce", borderRadius: 6,
                fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
              formatter={(value: unknown, name: unknown) => [
                value != null ? `$${Number(value).toFixed(3)}` : "\u2014",
                name === "price" ? "Actual" : "Forecast",
              ]}
              labelFormatter={(label: unknown) => String(label)}
            />
            <Line
              type="monotone" dataKey="price" stroke="#a03030" strokeWidth={2}
              dot={false} connectNulls={false} name="price"
            />
            {showForecast && (
              <Line
                type="monotone" dataKey="forecast" stroke="#a03030" strokeWidth={2}
                strokeDasharray="6 4" dot={false} connectNulls name="forecast"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* State rankings table */}
      {sortedStates.length > 0 && (
        <div className="mt-6">
          <ChartCard title="State Price Rankings" subtitle="Latest available week (select states with weekly data)" source="EIA Weekly Retail Gasoline and Diesel Prices">
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--color-chart-text)" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "2px solid #2d3d4a", fontWeight: 700, whiteSpace: "nowrap" }}>Rank</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "2px solid #2d3d4a", fontWeight: 700 }}>State</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "2px solid #2d3d4a", fontWeight: 700 }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStates.map((row, i) => (
                    <tr key={row.area_id}>
                      <td style={{ padding: "4px 12px", borderBottom: "1px solid #ddd8ce" }}>{i + 1}</td>
                      <td style={{ padding: "4px 12px", borderBottom: "1px solid #ddd8ce" }}>
                        <Link href={`/gas-prices/state/${row.area_id}`} style={{ color: "var(--blue-main)", fontWeight: 600, textDecoration: "none" }}>
                          {row.area_name}
                        </Link>
                      </td>
                      <td style={{ padding: "4px 12px", borderBottom: "1px solid #ddd8ce", textAlign: "right", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                        {fmtDollars(row.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
