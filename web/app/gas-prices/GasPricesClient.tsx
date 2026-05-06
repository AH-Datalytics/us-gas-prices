"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea,
} from "recharts";
import ScopeToggle from "@/components/ScopeToggle";
import { US_STATES } from "@/lib/constants";

const CountyMap = dynamic(() => import("./CountyMap"), { ssr: false, loading: () => <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--blue-mid)", fontSize: 12 }}>Loading map...</div> });
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

function downloadStateCsv(states: AaaStateRow[], filename: string) {
  const header = "State,Code,Regular,Midgrade,Premium,Diesel,Date";
  const rows = states.map((s) => `${s.state_name},${s.state},${s.regular ?? ""},${s.midgrade ?? ""},${s.premium ?? ""},${s.diesel ?? ""},${s.date}`);
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadCountyCsv(counties: { county: string; price: number }[], stateName: string, filename: string) {
  const header = "County,State,Regular_Price";
  const rows = counties.map((c) => `${c.county},${stateName},${c.price}`);
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function downloadJpeg(el: HTMLElement | null, filename: string, hasMap = false) {
  if (!el) return;

  if (hasMap) {
    // For map cards: render the map canvas to an image first, then capture
    const mapCanvas = el.querySelector("canvas") as HTMLCanvasElement | null;
    if (mapCanvas) {
      // Force a synchronous re-render of the WebGL canvas
      const gl = mapCanvas.getContext("webgl2") || mapCanvas.getContext("webgl");
      if (gl) {
        // Read pixels to force the buffer
        const w = mapCanvas.width;
        const h = mapCanvas.height;
        const pixels = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Create a 2D canvas with the pixel data (flipped vertically)
        const c2d = document.createElement("canvas");
        c2d.width = w;
        c2d.height = h;
        const ctx = c2d.getContext("2d")!;
        const imageData = ctx.createImageData(w, h);
        // WebGL reads bottom-to-top, flip it
        for (let y = 0; y < h; y++) {
          const srcRow = (h - 1 - y) * w * 4;
          const dstRow = y * w * 4;
          imageData.data.set(pixels.subarray(srcRow, srcRow + w * 4), dstRow);
        }
        ctx.putImageData(imageData, 0, 0);

        // Replace the WebGL canvas with a temp image
        const img = document.createElement("img");
        img.src = c2d.toDataURL("image/png");
        img.style.cssText = window.getComputedStyle(mapCanvas).cssText;
        img.style.position = "absolute";
        img.style.width = mapCanvas.clientWidth + "px";
        img.style.height = mapCanvas.clientHeight + "px";
        mapCanvas.style.display = "none";
        mapCanvas.parentElement?.appendChild(img);

        const { toJpeg } = await import("html-to-image");
        const url = await toJpeg(el, { backgroundColor: "#F5F0E8", pixelRatio: 2, quality: 0.95 });

        img.remove();
        mapCanvas.style.display = "";

        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        return;
      }
    }
  }

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
  const [countyData, setCountyData] = useState<{ county: string; price: number }[]>([]);
  const [countyLoading, setCountyLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const now = new Date();
  const defaultStart = `${now.getFullYear() - 2}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Fetch county data when state selected
  useEffect(() => {
    if (!selectedState) { setCountyData([]); setExpanded(false); return; }
    setCountyLoading(true);
    setExpanded(false);
    fetch(`/api/gas-state?state=${selectedState}&fuel=${fuel}`)
      .then((r) => r.json())
      .then((d) => setCountyData(d.counties || []))
      .finally(() => setCountyLoading(false));
  }, [selectedState, fuel]);

  const allPriceData = fuel === "regular_gas" ? nationalRegular : nationalDiesel;
  const steoData = fuel === "regular_gas" ? steoGas : steoDiesel;

  const priceData = allPriceData.filter((r) => {
    if (startDate && r.period < startDate) return false;
    if (endDate && r.period > endDate) return false;
    return true;
  });

  const chartData: { period: string; price: number | null; forecast: number | null }[] = priceData.map((r) => ({
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
        chartData.push({ period: row.period, price: null, forecast: row.value });
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
  const natAvg = latestNational?.price ?? 0;
  const highDiff = sortedStates[0] ? sortedStates[0].regular! - natAvg : 0;
  const lowDiff = lowestState ? lowestState.regular! - natAvg : 0;

  // County stats
  const countyAvg = countyData.length > 0 ? countyData.reduce((s, c) => s + c.price, 0) / countyData.length : 0;
  const countyHigh = countyData.length > 0 ? countyData[0] : null; // already sorted desc from API
  const countyLow = countyData.length > 0 ? countyData[countyData.length - 1] : null;

  const exportBtnClass = "text-[10px] text-[var(--blue-mid)] hover:text-[var(--blue-main)] underline decoration-dotted underline-offset-2 cursor-pointer transition-colors";

  return (
    <div style={{ maxWidth: 1400 }} className="mx-auto px-6 py-4">
      {/* Map + Chart side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Map */}
        <div className="chart-card" ref={mapRef} style={{ padding: "14px 16px 10px", position: "relative" }}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 style={{ marginBottom: 0, fontSize: 15 }}>US Gas Prices</h2>
              <div className="subtitle" style={{ marginBottom: 2, fontSize: 10 }}>Click a state for county breakdown</div>
            </div>
            <div className="flex items-center gap-3">
              <button className={exportBtnClass} onClick={() => {
                if (selectedState && countyData.length > 0) {
                  downloadCountyCsv(countyData, selectedStateName, `gas-prices-${selectedState}-counties.csv`);
                } else {
                  downloadStateCsv(sortedStates, "gas-prices-by-state.csv");
                }
              }}>CSV</button>
              {/* <button className={exportBtnClass} onClick={() => downloadJpeg(mapRef.current, selectedState ? `gas-prices-${selectedState}.jpg` : "gas-prices-map.jpg", true)}>JPEG</button> */}
            </div>
          </div>
          <CountyMap aaaStates={aaaStates} onStateClick={setSelectedState} selectedState={selectedState} countyData={countyData} nationalAvg={natAvg} />
          <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
            <div className="source">Source: AAA Fuel Prices</div>
            <img src="/logo-navy.png" alt="AH Datalytics" style={{ height: 16, opacity: 0.4 }} />
          </div>
        </div>

        {/* Chart */}
        <div className="chart-card" ref={chartRef} style={{ padding: "14px 16px 10px" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <div>
              <h2 style={{ marginBottom: 0, fontSize: 15 }}>U.S. {fuel === "regular_gas" ? "Regular Gasoline" : "Diesel"} Prices</h2>
              <div className="subtitle" style={{ marginBottom: 0, fontSize: 10 }}>Weekly, $/gallon</div>
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
              <button className={`forecast-btn ${showForecast ? "active" : ""}`} onClick={() => setShowForecast(!showForecast)}>
                Forecast
              </button>
            </div>
          </div>

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

          <div style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ddd8ce" vertical={false} />
                {showForecast && forecastStart && chartData.length > 0 && (
                  <ReferenceArea x1={forecastStart} x2={chartData[chartData.length - 1].period} fill="#f5f0e8" fillOpacity={0.5} stroke="none" />
                )}
                <XAxis dataKey="period"
                  tick={{ fontSize: 9, fill: "#5a6a7a" }}
                  tickLine={false}
                  axisLine={{ stroke: "#ddd8ce" }}
                  ticks={(() => {
                    if (chartData.length === 0) return [];
                    const totalMonths = chartData.length / 4.3;
                    const useYears = totalMonths > 48;
                    if (useYears) {
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
                  height={36}
                />
                <YAxis tick={{ fontSize: 10, fill: "#5a6a7a" }} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`} domain={["auto", "auto"]}
                />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ddd8ce", borderRadius: 6, fontSize: 11, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                  formatter={(value: unknown, name: unknown) => [value != null ? `$${Number(value).toFixed(3)}` : "\u2014", name === "price" ? "Actual" : "Forecast"]}
                  labelFormatter={(label: unknown) => String(label)}
                />
                <Line type="monotone" dataKey="price" stroke="#a03030" strokeWidth={2} dot={false} connectNulls={false} />
                {showForecast && <Line type="monotone" dataKey="forecast" stroke="#a03030" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between">
            <div className="source">Source: EIA Weekly Retail Gasoline and Diesel Prices.{showForecast ? " Forecast: EIA Short-Term Energy Outlook (STEO), updated monthly." : ""}</div>
            <img src="/logo-navy.png" alt="AH Datalytics" style={{ height: 16, opacity: 0.4 }} />
          </div>
        </div>
      </div>

      {/* Stat cards — swap content based on state selection */}
      <div className="grid grid-cols-3 gap-3">
        {!selectedState ? (
          <>
            <div className="stat-box">
              <div className="stat-label">National Average</div>
              <div className="stat-value">
                {latestNational ? fmtDollars(latestNational.price) : "\u2014"}
                {weekChange != null && (
                  <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 6, color: weekChange >= 0 ? "#a03030" : "#10b981" }}>
                    {weekChange >= 0 ? "\u25B2" : "\u25BC"} {fmtDollars(Math.abs(weekChange))} vs last week
                  </span>
                )}
              </div>
              <div className="stat-sub">per gallon &middot; week of {latestNational?.period || ""}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Highest State</div>
              <div className="stat-value">
                {sortedStates[0] ? fmtDollars(sortedStates[0].regular) : "\u2014"}
                {highDiff > 0 && <span style={{ fontSize: 11, color: "#a03030", marginLeft: 6 }}>+{fmtDollars(highDiff)} vs nat&apos;l</span>}
              </div>
              <div className="stat-sub">{sortedStates[0]?.state_name || ""}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Lowest State</div>
              <div className="stat-value">
                {lowestState ? fmtDollars(lowestState.regular) : "\u2014"}
                {lowDiff < 0 && <span style={{ fontSize: 11, color: "#10b981", marginLeft: 6 }}>{fmtDollars(lowDiff)} vs nat&apos;l</span>}
              </div>
              <div className="stat-sub">{lowestState?.state_name || ""}</div>
            </div>
          </>
        ) : (
          <>
            <div className="stat-box">
              <div className="stat-label">{selectedStateName} Average</div>
              <div className="stat-value">{selectedAaa ? fmtDollars(selectedAaa.regular) : "\u2014"}</div>
              <div className="stat-sub">{countyData.length} counties &middot; <button className={exportBtnClass} onClick={() => downloadCountyCsv(countyData, selectedStateName, `gas-prices-${selectedState}-counties.csv`)}>Download CSV</button></div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Most Expensive County</div>
              <div className="stat-value" style={{ color: "#a03030" }}>{countyHigh ? fmtDollars(countyHigh.price) : "\u2014"}</div>
              <div className="stat-sub">{countyHigh?.county || ""}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Least Expensive County</div>
              <div className="stat-value" style={{ color: "#10b981" }}>{countyLow ? fmtDollars(countyLow.price) : "\u2014"}</div>
              <div className="stat-sub">{countyLow?.county || ""}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
