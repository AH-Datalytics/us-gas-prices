"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import ChartCard from "@/components/ChartCard";
import ScopeToggle from "@/components/ScopeToggle";
import EmptyState from "@/components/EmptyState";
import type { GasPriceRow, SteoRow } from "@/lib/queries";
import { fmtDollars, fmtMonth } from "@/lib/utils";

interface Props {
  stateId: string;
  stateName: string;
  stateRegular: GasPriceRow[];
  stateDiesel: GasPriceRow[];
  nationalRegular: GasPriceRow[];
  nationalDiesel: GasPriceRow[];
  cities: GasPriceRow[];
  steoGas: SteoRow[];
}

export default function StateClient({
  stateId, stateName, stateRegular, stateDiesel, nationalRegular, nationalDiesel, cities, steoGas,
}: Props) {
  const [fuel, setFuel] = useState<"regular_gas" | "diesel">("regular_gas");
  const [showForecast, setShowForecast] = useState(false);

  const stateData = fuel === "regular_gas" ? stateRegular : stateDiesel;
  const nationalData = fuel === "regular_gas" ? nationalRegular : nationalDiesel;

  if (stateData.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-8 py-6">
        <Link href="/gas-prices" className="back-link mb-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Gas Prices
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--blue-dark)", fontFamily: "var(--font-display)", marginBottom: 16, marginTop: 8 }}>
          {stateName}
        </h1>
        <EmptyState message={`No weekly price data available for ${stateName}. The EIA only publishes weekly retail prices for select states.`} />
      </div>
    );
  }

  const nationalMap = new Map(nationalData.map((r) => [r.period, r.price]));
  const chartData: { period: string; state: number | null; national: number | null; forecast: number | null }[] = stateData.map((r) => ({
    period: r.period,
    state: r.price,
    national: nationalMap.get(r.period) ?? null,
    forecast: null,
  }));

  if (showForecast && steoGas.length > 0 && fuel === "regular_gas") {
    const lastActual = stateData[stateData.length - 1]?.period || "";
    const bridgeIdx = chartData.findIndex((d) => d.period === lastActual);
    if (bridgeIdx >= 0) chartData[bridgeIdx].forecast = chartData[bridgeIdx].state;
    for (const row of steoGas) {
      if (row.period > lastActual) {
        chartData.push({ period: row.period, state: null, national: null, forecast: row.value });
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-6">
      <Link href="/gas-prices" className="back-link mb-4">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Gas Prices
      </Link>

      <div className="flex items-center justify-between mb-6 mt-2">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--blue-dark)", fontFamily: "var(--font-display)" }}>
          {stateName}
        </h1>
        <div className="flex items-center gap-3">
          <ScopeToggle
            options={[
              { value: "regular_gas", label: "Regular" },
              { value: "diesel", label: "Diesel" },
            ]}
            active={fuel}
            onChange={(v) => setFuel(v as "regular_gas" | "diesel")}
          />
          {fuel === "regular_gas" && (
            <button className={`forecast-btn ${showForecast ? "active" : ""}`} onClick={() => setShowForecast(!showForecast)}>
              {showForecast ? "Hide" : "Show"} Forecast
            </button>
          )}
        </div>
      </div>

      <ChartCard
        title={`${stateName} vs. National Average`}
        subtitle="Weekly, dollars per gallon"
        source="EIA Gasoline and Diesel Fuel Update"
      >
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd8ce" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={{ stroke: "#ddd8ce" }}
              interval={Math.max(Math.floor(chartData.length / 10) - 1, 0)}
              tickFormatter={(v: string) => { const p = v.split("-"); return fmtMonth(`${p[0]}-${p[1]}`); }}
            />
            <YAxis tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(2)}`} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ddd8ce", borderRadius: 6, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
              formatter={(value: unknown, name: unknown) => [`$${Number(value).toFixed(3)}`, name === "state" ? stateName : name === "national" ? "National Avg" : "Forecast (National)"]}
              labelFormatter={(label: unknown) => String(label)}
            />
            <Line type="monotone" dataKey="state" stroke="#a03030" strokeWidth={2} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="national" stroke="#4a7aaa" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls={false} />
            {showForecast && <Line type="monotone" dataKey="forecast" stroke="#a03030" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />}
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {cities.length > 0 && (
        <div className="mt-6">
          <ChartCard title="City Prices" subtitle="Latest available week" source="EIA">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--color-chart-text)" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "2px solid #2d3d4a", fontWeight: 700 }}>City</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "2px solid #2d3d4a", fontWeight: 700 }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => (
                  <tr key={c.area_id}>
                    <td style={{ padding: "4px 12px", borderBottom: "1px solid #ddd8ce" }}>{c.area_name}</td>
                    <td style={{ padding: "4px 12px", borderBottom: "1px solid #ddd8ce", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtDollars(c.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
