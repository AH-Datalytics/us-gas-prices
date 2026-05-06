"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea,
} from "recharts";
import ScopeToggle from "@/components/ScopeToggle";
import { US_STATES } from "@/lib/constants";

const CountyMap = dynamic(() => import("./CountyMap"), { ssr: false, loading: () => <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--blue-mid)", fontSize: 12 }}>Loading map...</div> });
import type { GasPriceRow, SteoRow, AaaStateRow } from "@/lib/queries";
import { fmtDollars } from "@/lib/utils";

interface Props {
  nationalRegular: GasPriceRow[];
  nationalDiesel: GasPriceRow[];
  steoGas: SteoRow[];
  steoDiesel: SteoRow[];
  aaaStates: AaaStateRow[];
}

function downloadCsv(data: { period: string; price: number | null; forecast: number | null }[], filename: string) {
  const header = "Period,Price,Forecast";
  const rows = data.map((r) => `${r.period},${r.price ?? ""},${r.forecast ?? ""}`);
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadMapCsv(states: AaaStateRow[], filename: string) {
  const header = "State,Code,Regular,Midgrade,Premium,Diesel,Date";
  const rows = states.map((s) => `${s.state_name},${s.state},${s.regular ?? ""},${s.midgrade ?? ""},${s.premium ?? ""},${s.diesel ?? ""},${s.date}`);
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function downloadJpeg(el: HTMLElement | null, filename: string) {
  if (!el) return;
  const { toJpeg } = await import("html-to-image");
  const url = await toJpeg(el, { backgroundColor: "#F5F0E8", pixelRatio: 2, quality: 0.95 });
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
}

function fmtAxisLabel(v: string, yearOnly: boolean): string {
  const p = v.split("-");
  if (p.length < 2) return v;
  if (yearOnly) return p[0];
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(p[1]) - 1] || p[1]} ${p[0]}`;
}

export default function GasPricesClient({
  nationalRegular, nationalDiesel, steoGas, steoDiesel, aaaStates,
}: Props) {
  const [fuel, setFuel] = useState<"regular_gas" | "diesel">("regular_gas");
  const [showForecast, setShowForecast] = useState(false);
  const [selectedState, setSelectedState] = useState("");
  const now = new Date();
  const defaultStart = `${now.getFullYear() - 2}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const allPriceData = fuel === "regular_gas" ? nationalRegular : nationalDiesel;
  const steoData = fuel === "regular_gas" ? steoGas : steoDiesel;

  const priceData = allPriceData.filter((r) => {
    if (startDate && r.period < startDate) return false;
    if (endDate && r.period > endDate) return false;
    return true;
  });

  // Build chart data with forecast shading region
  const chartData: { period: string; price: number | null; forecast: number | null; isForecast?: boolean }[] = priceData.map((r) => ({
    period: r.period, price: r.price, forecast: null,
  }));
  let forecastStart = "";
  if (showForecast && steoData.length > 0) {
    const lastActual = priceData[priceData.length - 1]?.period || "";
    forecastStart = lastActual;
    const bridgeIdx = chartData.findIndex((d) => d.period === lastActual);
    if (bridgeIdx >= 0) chartData[bridgeIdx].forecast = chartData[bridgeIdx].price;
    for (const row of steoData) {
      if (row.period > lastActual) {
        chartData.push({ period: row.period, price: null, forecast: row.value, isForecast: true });
      }
    }
  }

  const latestNational = allPriceData[allPriceData.length - 1];
  const prevWeek = allPriceData.length >= 2 ? allPriceData[allPriceData.length - 2] : null;
  const weekChange = latestNational && prevWeek ? latestNational.price - prevWeek.price : null;
  const sortedStates = [...aaaStates].sort((a, b) => (b.regular ?? 0) - (a.regular ?? 0));
  const selectedAaa = aaaStates.find((s) => s.state === selectedState);
  const selectedStateName = US_STATES.find((s) => s.code === selectedState)?.name || "";
  const lowestState = sortedStates[sortedStates.length - 1];

  // Stat: how far above/below national
  const natAvg = latestNational?.price ?? 0;
  const highDiff = sortedStates[0] ? sortedStates[0].regular! - natAvg : 0;
  const lowDiff = lowestState ? lowestState.regular! - natAvg : 0;

  const exportBtnClass = "text-[10px] text-[var(--blue-mid)] hover:text-[var(--blue-main)] underline decoration-dotted underline-offset-2 cursor-pointer transition-colors";

  return (
    <div style={{ maxWidth: 1400 }} className="mx-auto px-6 py-4">
      {/* Map + Chart side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Map */}
        <div className="chart-card" ref={mapRef} style={{ padding: "16px 20px 12px" }}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 style={{ marginBottom: 0, fontSize: 16 }}>US Gas Prices</h2>
              <div className="subtitle" style={{ marginBottom: 2, fontSize: 11 }}>Click a state for county breakdown</div>
            </div>
            <div className="flex items-center gap-3">
              <button className={exportBtnClass} onClick={() => downloadMapCsv(sortedStates, "gas-prices-by-state.csv")}>CSV</button>
              <button className={exportBtnClass} onClick={() => downloadJpeg(mapRef.current, "gas-prices-map.jpg")}>JPEG</button>
            </div>
          </div>
          <CountyMap aaaStates={aaaStates} onStateClick={setSelectedState} selectedState={selectedState} />
          {/* AHD logo watermark */}
          <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
            <div className="source">Source: AAA Fuel Prices (130,000+ stations)</div>
            <img src="/logo-navy.png" alt="AH Datalytics" style={{ height: 18, opacity: 0.4 }} />
          </div>
        </div>

        {/* Chart */}
        <div className="chart-card" ref={chartRef} style={{ padding: "16px 20px 12px", display: "flex", flexDirection: "column" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <div>
              <h2 style={{ marginBottom: 0, fontSize: 16 }}>U.S. {fuel === "regular_gas" ? "Regular Gasoline" : "Diesel"} Prices</h2>
              <div className="subtitle" style={{ marginBottom: 0, fontSize: 11 }}>Weekly, $/gallon</div>
            </div>
            <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
              <button className={exportBtnClass} onClick={() => downloadCsv(chartData, `gas-prices-${fuel}.csv`)}>CSV</button>
              <button className={exportBtnClass} onClick={() => downloadJpeg(chartRef.current, `gas-prices-${fuel}.jpg`)}>JPEG</button>
              <span style={{ width: 1, height: 14, background: "var(--blue-light)", margin: "0 2px" }} />
              <ScopeToggle
                options={[
                  { value: "regular_gas", label: "Regular" },
                  { value: "diesel", label: "Diesel" },
                ]}
                active={fuel}
                onChange={(v) => setFuel(v as "regular_gas" | "diesel")}
              />
              <button
                className={`forecast-btn ${showForecast ? "active" : ""}`}
                onClick={() => setShowForecast(!showForecast)}
              >
                Forecast
              </button>
            </div>
          </div>

          {/* Date range presets */}
          <div className="flex items-center gap-1.5" style={{ marginBottom: 6 }}>
            {[
              { label: "3M", months: 3 },
              { label: "6M", months: 6 },
              { label: "1Y", months: 12 },
              { label: "2Y", months: 24 },
              { label: "5Y", months: 60 },
              { label: "10Y", months: 120 },
              { label: "All", months: 0 },
            ].map((p) => {
              const pStart = p.months > 0
                ? `${new Date(now.getFullYear(), now.getMonth() - p.months, 1).getFullYear()}-${String(new Date(now.getFullYear(), now.getMonth() - p.months, 1).getMonth() + 1).padStart(2, "0")}`
                : "";
              const isActive = startDate === pStart;
              return (
                <button key={p.label} className={`preset-btn ${isActive ? "active" : ""}`}
                  style={{ fontSize: 9, padding: "2px 8px" }}
                  onClick={() => { setStartDate(pStart); setEndDate(""); }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Chart */}
          <div style={{ flex: 1, minHeight: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ddd8ce" vertical={false} />
                {/* Forecast shaded region */}
                {showForecast && forecastStart && chartData.length > 0 && (
                  <ReferenceArea
                    x1={forecastStart}
                    x2={chartData[chartData.length - 1].period}
                    fill="#f5f0e8"
                    fillOpacity={0.5}
                    stroke="none"
                  />
                )}
                <XAxis dataKey="period"
                  tick={{ fontSize: 10, fill: "#5a6a7a" }}
                  tickLine={false}
                  axisLine={{ stroke: "#ddd8ce" }}
                  ticks={(() => {
                    if (chartData.length === 0) return [];
                    const totalMonths = chartData.length / 4.3;
                    const useYears = totalMonths > 48; // 4+ years → year ticks
                    if (useYears) {
                      // Pick January of each year (or every N years)
                      const seen = new Set<string>();
                      const ticks: string[] = [];
                      const totalYears = totalMonths / 12;
                      const yearStep = Math.max(1, Math.round(totalYears / 8));
                      for (const d of chartData) {
                        const yr = d.period.slice(0, 4);
                        const mo = d.period.slice(5, 7);
                        if (mo === "01" && !seen.has(yr)) {
                          seen.add(yr);
                          if (seen.size % yearStep === 1 || yearStep === 1) ticks.push(d.period);
                        }
                      }
                      return ticks;
                    }
                    const step = Math.max(1, Math.round(totalMonths / 8));
                    const seen = new Set<string>();
                    const ticks: string[] = [];
                    for (const d of chartData) {
                      const ym = d.period.slice(0, 7);
                      if (!seen.has(ym)) {
                        seen.add(ym);
                        if (seen.size % step === 1 || step === 1) ticks.push(d.period);
                      }
                    }
                    return ticks;
                  })()}
                  tickFormatter={(v: string) => fmtAxisLabel(v, chartData.length / 4.3 > 48)}
                  angle={-30}
                  textAnchor="end"
                  height={40}
                />
                <YAxis tick={{ fontSize: 10, fill: "#5a6a7a" }} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`} domain={["auto", "auto"]}
                />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ddd8ce", borderRadius: 6, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                  formatter={(value: unknown, name: unknown) => [value != null ? `$${Number(value).toFixed(3)}` : "\u2014", name === "price" ? "Actual" : "Forecast"]}
                  labelFormatter={(label: unknown) => String(label)}
                />
                <Line type="monotone" dataKey="price" stroke="#a03030" strokeWidth={2} dot={false} connectNulls={false} />
                {showForecast && <Line type="monotone" dataKey="forecast" stroke="#a03030" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {/* Footer with source + logo */}
          <div className="flex items-center justify-between">
            <div className="source">Source: EIA Weekly Retail Gasoline and Diesel Prices.{showForecast ? " Forecast: EIA Short-Term Energy Outlook (STEO), updated monthly." : ""}</div>
            <img src="/logo-navy.png" alt="AH Datalytics" style={{ height: 18, opacity: 0.4 }} />
          </div>
        </div>
      </div>

      {/* Stat cards at bottom */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-box">
          <div className="stat-label">National Average</div>
          <div className="stat-value">
            {latestNational ? fmtDollars(latestNational.price) : "\u2014"}
            {weekChange != null && (
              <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 6, color: weekChange >= 0 ? "#a03030" : "#10b981" }}>
                {weekChange >= 0 ? "\u25B2" : "\u25BC"} {fmtDollars(Math.abs(weekChange))}
              </span>
            )}
          </div>
          <div className="stat-sub">per gallon &middot; week of {latestNational?.period || ""}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Highest State</div>
          <div className="stat-value">
            {sortedStates[0] ? fmtDollars(sortedStates[0].regular) : "\u2014"}
            {highDiff > 0 && <span style={{ fontSize: 11, color: "#a03030", marginLeft: 6 }}>+{fmtDollars(highDiff)} vs nat'l</span>}
          </div>
          <div className="stat-sub">{sortedStates[0]?.state_name || ""}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">{selectedStateName || "Lowest State"}</div>
          <div className="stat-value">
            {selectedAaa ? fmtDollars(selectedAaa.regular) : lowestState ? fmtDollars(lowestState.regular) : "\u2014"}
            {!selectedAaa && lowDiff < 0 && <span style={{ fontSize: 11, color: "#10b981", marginLeft: 6 }}>{fmtDollars(lowDiff)} vs nat'l</span>}
          </div>
          <div className="stat-sub">
            {selectedAaa ? "click map to change" : lowestState?.state_name || ""}
          </div>
        </div>
      </div>
    </div>
  );
}
