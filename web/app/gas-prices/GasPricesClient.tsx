"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import ChartCard from "@/components/ChartCard";
import ScopeToggle from "@/components/ScopeToggle";
import EmptyState from "@/components/EmptyState";
import { US_STATES } from "@/lib/constants";
import type { GasPriceRow, SteoRow, AaaStateRow } from "@/lib/queries";
import { fmtDollars, fmtMonth } from "@/lib/utils";

interface Props {
  nationalRegular: GasPriceRow[];
  nationalDiesel: GasPriceRow[];
  steoGas: SteoRow[];
  steoDiesel: SteoRow[];
  aaaStates: AaaStateRow[];
}

// ─── Choropleth Map (inline SVG approach for simplicity) ───

function StateChoropleth({ states, onSelect }: { states: AaaStateRow[]; onSelect: (code: string) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [tooltip, setTooltip] = useState<{ name: string; price: string; x: number; y: number } | null>(null);

  useEffect(() => {
    fetch("/us-states.json")
      .then((r) => r.json())
      .then(setGeojson)
      .catch(() => {});
  }, []);

  if (!geojson || states.length === 0) return null;

  // Build price lookup by state name
  const priceMap = new Map<string, number>();
  for (const s of states) {
    priceMap.set(s.state_name, s.regular ?? 0);
  }

  // Color scale
  const prices = states.filter((s) => s.regular != null).map((s) => s.regular!);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);

  function getColor(price: number | undefined): string {
    if (price == null) return "#e2e8f0";
    const t = maxP > minP ? (price - minP) / (maxP - minP) : 0.5;
    // Blue (low) to red (high)
    const r = Math.round(45 + t * (160 - 45));
    const g = Math.round(95 + (1 - t) * (138 - 95) - t * 47);
    const b = Math.round(138 - t * 90);
    return `rgb(${r},${g},${b})`;
  }

  return (
    <div ref={mapRef} style={{ position: "relative" }}>
      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 10, color: "var(--blue-mid)" }}>
        <span>{fmtDollars(minP)}</span>
        <div style={{
          width: 120, height: 8, borderRadius: 4,
          background: `linear-gradient(to right, ${getColor(minP)}, ${getColor((minP + maxP) / 2)}, ${getColor(maxP)})`,
        }} />
        <span>{fmtDollars(maxP)}</span>
      </div>

      {/* State table as a visual grid (since inline SVG map is complex) */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 3,
      }}>
        {states.map((s) => {
          const stateInfo = US_STATES.find((us) => us.code === s.state);
          return (
            <button
              key={s.state}
              onClick={() => onSelect(s.state)}
              style={{
                background: getColor(s.regular ?? undefined),
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 4,
                padding: "6px 4px",
                cursor: "pointer",
                textAlign: "center",
                transition: "transform 0.1s, box-shadow 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "none";
              }}
              title={`${s.state_name}: ${fmtDollars(s.regular)}`}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                {s.state}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.9)", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                {fmtDollars(s.regular)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───

export default function GasPricesClient({
  nationalRegular, nationalDiesel, steoGas, steoDiesel, aaaStates,
}: Props) {
  const [scope, setScope] = useState<"national" | "state" | "city">("national");
  const [fuel, setFuel] = useState<"regular_gas" | "diesel">("regular_gas");
  const [showForecast, setShowForecast] = useState(false);
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  // State-level EIA data (fetched client-side when state selected)
  const [stateData, setStateData] = useState<GasPriceRow[]>([]);
  const [cityList, setCityList] = useState<{ area_id: string; area_name: string }[]>([]);
  const [cityData, setCityData] = useState<GasPriceRow[]>([]);
  const [countyData, setCountyData] = useState<{ county: string; price: number }[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch state data when selected
  useEffect(() => {
    if (!selectedState) return;
    setLoading(true);
    fetch(`/api/gas-state?state=${selectedState}&fuel=${fuel}`)
      .then((r) => r.json())
      .then((d) => {
        setStateData(d.prices || []);
        setCityList(d.cities || []);
        setCountyData(d.counties || []);
      })
      .finally(() => setLoading(false));
  }, [selectedState, fuel]);

  // Fetch city data when selected
  useEffect(() => {
    if (!selectedCity) return;
    setLoading(true);
    fetch(`/api/gas-city?city=${selectedCity}&fuel=${fuel}`)
      .then((r) => r.json())
      .then((d) => setCityData(d.prices || []))
      .finally(() => setLoading(false));
  }, [selectedCity, fuel]);

  const priceData = fuel === "regular_gas" ? nationalRegular : nationalDiesel;
  const steoData = fuel === "regular_gas" ? steoGas : steoDiesel;

  // Build national chart data
  const nationalChart: { period: string; price: number | null; forecast: number | null }[] = priceData.map((r) => ({
    period: r.period, price: r.price, forecast: null,
  }));
  if (showForecast && steoData.length > 0) {
    const lastActual = priceData[priceData.length - 1]?.period || "";
    const bridgeIdx = nationalChart.findIndex((d) => d.period === lastActual);
    if (bridgeIdx >= 0) nationalChart[bridgeIdx].forecast = nationalChart[bridgeIdx].price;
    for (const row of steoData) {
      if (row.period > lastActual) {
        nationalChart.push({ period: row.period, price: null, forecast: row.value });
      }
    }
  }

  // Build state comparison chart
  const nationalMap = new Map(priceData.map((r) => [r.period, r.price]));
  const stateChart = stateData.map((r) => ({
    period: r.period,
    state: r.price,
    national: nationalMap.get(r.period) ?? null,
  }));

  // Build city comparison chart
  const cityChart = cityData.map((r) => ({
    period: r.period,
    city: r.price,
    national: nationalMap.get(r.period) ?? null,
  }));

  const latestNational = priceData[priceData.length - 1];
  const sortedStates = [...aaaStates].sort((a, b) => (b.regular ?? 0) - (a.regular ?? 0));
  const selectedStateName = US_STATES.find((s) => s.code === selectedState)?.name || selectedState;

  function handleStateSelect(code: string) {
    setSelectedState(code);
    setSelectedCity("");
    setScope("state");
  }

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
              { value: "national", label: "National" },
              { value: "state", label: "State" },
              { value: "city", label: "City" },
            ]}
            active={scope}
            onChange={(v) => setScope(v as "national" | "state" | "city")}
          />
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
            {showForecast ? "Hide" : "Show"} Forecast
          </button>
        </div>
      </div>

      {/* ─── NATIONAL VIEW ─── */}
      {scope === "national" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="stat-box">
              <div className="stat-label">National Average</div>
              <div className="stat-value">{latestNational ? fmtDollars(latestNational.price) : "\u2014"}</div>
              <div className="stat-sub">per gallon &middot; {latestNational?.period || ""}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Highest State</div>
              <div className="stat-value">{sortedStates[0] ? fmtDollars(sortedStates[0].regular) : "\u2014"}</div>
              <div className="stat-sub">{sortedStates[0]?.state_name || ""}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Lowest State</div>
              <div className="stat-value">{sortedStates.length > 0 ? fmtDollars(sortedStates[sortedStates.length - 1].regular) : "\u2014"}</div>
              <div className="stat-sub">{sortedStates[sortedStates.length - 1]?.state_name || ""}</div>
            </div>
          </div>

          {/* Choropleth */}
          {aaaStates.length > 0 && (
            <div className="mb-6">
              <ChartCard title="Regular Gasoline by State" subtitle="Today's average price per gallon (AAA)" source="AAA Fuel Prices">
                <StateChoropleth states={sortedStates} onSelect={handleStateSelect} />
              </ChartCard>
            </div>
          )}

          {/* National trend */}
          <ChartCard
            title={`U.S. ${fuel === "regular_gas" ? "Regular Gasoline" : "Diesel"} Prices`}
            subtitle="Weekly average, dollars per gallon"
            source="EIA Weekly Retail Gasoline and Diesel Prices + STEO"
          >
            <TrendChart data={nationalChart} showForecast={showForecast} />
          </ChartCard>

          {/* State rankings table */}
          {sortedStates.length > 0 && (
            <div className="mt-6">
              <ChartCard title="All 50 States + DC" subtitle="Today's regular gasoline price" source="AAA Fuel Prices">
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--color-chart-text)" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "2px solid #2d3d4a", fontWeight: 700 }}>#</th>
                        <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "2px solid #2d3d4a", fontWeight: 700 }}>State</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "2px solid #2d3d4a", fontWeight: 700 }}>Regular</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "2px solid #2d3d4a", fontWeight: 700 }}>Diesel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStates.map((row, i) => (
                        <tr key={row.state} style={{ cursor: "pointer" }} onClick={() => handleStateSelect(row.state)}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--blue-pale)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                        >
                          <td style={{ padding: "4px 12px", borderBottom: "1px solid #ddd8ce" }}>{i + 1}</td>
                          <td style={{ padding: "4px 12px", borderBottom: "1px solid #ddd8ce", color: "var(--blue-main)", fontWeight: 600 }}>
                            {row.state_name}
                          </td>
                          <td style={{ padding: "4px 12px", borderBottom: "1px solid #ddd8ce", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            {fmtDollars(row.regular)}
                          </td>
                          <td style={{ padding: "4px 12px", borderBottom: "1px solid #ddd8ce", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--blue-mid)" }}>
                            {fmtDollars(row.diesel)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            </div>
          )}
        </>
      )}

      {/* ─── STATE VIEW ─── */}
      {scope === "state" && (
        <>
          <div className="control-bar">
            <select value={selectedState} onChange={(e) => { setSelectedState(e.target.value); setSelectedCity(""); }}
              style={{ background: "var(--color-surface)", border: "1.5px solid var(--blue-light)", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 500, color: "var(--blue-dark)", fontFamily: "inherit" }}
            >
              <option value="">Select a state...</option>
              {US_STATES.map((s) => (<option key={s.code} value={s.code}>{s.name}</option>))}
            </select>
          </div>

          {!selectedState && <EmptyState message="Select a state to view prices" />}

          {selectedState && loading && <div className="text-center py-8" style={{ color: "var(--blue-mid)", fontSize: 13 }}>Loading {selectedStateName}...</div>}

          {selectedState && !loading && (
            <>
              {/* County prices */}
              {countyData.length > 0 && (
                <div className="mb-6">
                  <ChartCard title={`${selectedStateName} County Prices`} subtitle="Today's regular gasoline average" source="AAA Fuel Prices">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 2, maxHeight: 300, overflowY: "auto" }}>
                      {countyData.map((c) => (
                        <div key={c.county} style={{ display: "flex", justifyContent: "space-between", padding: "3px 8px", fontSize: 11, borderBottom: "1px solid #eee" }}>
                          <span style={{ color: "var(--blue-dark)" }}>{c.county}</span>
                          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtDollars(c.price)}</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                </div>
              )}

              {/* State trend vs national (EIA data) */}
              {stateChart.length > 0 ? (
                <ChartCard title={`${selectedStateName} vs. National Average`} subtitle="Weekly, dollars per gallon (EIA)" source="EIA Weekly Retail Gasoline and Diesel Prices">
                  <ComparisonChart data={stateChart} label={selectedStateName} comparisonKey="state" />
                </ChartCard>
              ) : (
                <div className="info-callout">
                  The EIA only publishes weekly price history for 9 select states. {selectedStateName} is not one of them. County prices above are from AAA (today only).
                </div>
              )}

              {/* City list */}
              {cityList.length > 0 && (
                <div className="mt-4">
                  <ChartCard title="Cities" subtitle="Click to view trend">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {cityList.map((c) => (
                        <button key={c.area_id} onClick={() => { setSelectedCity(c.area_id); setScope("city"); }}
                          className="preset-btn"
                        >
                          {c.area_name}
                        </button>
                      ))}
                    </div>
                  </ChartCard>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ─── CITY VIEW ─── */}
      {scope === "city" && (
        <>
          <div className="control-bar">
            <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}
              style={{ background: "var(--color-surface)", border: "1.5px solid var(--blue-light)", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 500, color: "var(--blue-dark)", fontFamily: "inherit" }}
            >
              <option value="">Select a city...</option>
              {[
                { id: "YBOS", name: "Boston" }, { id: "YORD", name: "Chicago" },
                { id: "YCLE", name: "Cleveland" }, { id: "YDEN", name: "Denver" },
                { id: "Y44HO", name: "Houston" }, { id: "Y05LA", name: "Los Angeles" },
                { id: "YMIA", name: "Miami" }, { id: "Y35NY", name: "New York City" },
                { id: "Y05SF", name: "San Francisco" }, { id: "Y48SE", name: "Seattle" },
              ].map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>

          {!selectedCity && <EmptyState message="Select a city to view prices" />}

          {selectedCity && loading && <div className="text-center py-8" style={{ color: "var(--blue-mid)", fontSize: 13 }}>Loading...</div>}

          {selectedCity && !loading && cityChart.length > 0 && (
            <ChartCard
              title={`${cityData[0]?.area_name || selectedCity} vs. National Average`}
              subtitle="Weekly, dollars per gallon"
              source="EIA Weekly Retail Gasoline and Diesel Prices"
            >
              <ComparisonChart data={cityChart} label={cityData[0]?.area_name || selectedCity} comparisonKey="city" />
            </ChartCard>
          )}

          {selectedCity && !loading && cityChart.length === 0 && (
            <EmptyState message={`No weekly price data for this city`} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Shared Chart Components ───

function TrendChart({ data, showForecast }: { data: { period: string; price: number | null; forecast: number | null }[]; showForecast: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ddd8ce" vertical={false} />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={{ stroke: "#ddd8ce" }}
          interval={Math.max(Math.floor(data.length / 12) - 1, 0)}
          tickFormatter={(v: string) => { const p = v.split("-"); return p.length >= 2 ? fmtMonth(`${p[0]}-${p[1]}`) : v; }}
        />
        <YAxis tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={false}
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
  );
}

function ComparisonChart({ data, label, comparisonKey }: { data: Record<string, unknown>[]; label: string; comparisonKey: string }) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ddd8ce" vertical={false} />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={{ stroke: "#ddd8ce" }}
          interval={Math.max(Math.floor(data.length / 10) - 1, 0)}
          tickFormatter={(v: string) => { const p = v.split("-"); return fmtMonth(`${p[0]}-${p[1]}`); }}
        />
        <YAxis tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={false}
          tickFormatter={(v: number) => `$${v.toFixed(2)}`} domain={["auto", "auto"]}
        />
        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ddd8ce", borderRadius: 6, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          formatter={(value: unknown, name: unknown) => [`$${Number(value).toFixed(3)}`, name === comparisonKey ? label : "National Avg"]}
          labelFormatter={(label: unknown) => String(label)}
        />
        <Line type="monotone" dataKey={comparisonKey} stroke="#a03030" strokeWidth={2} dot={false} connectNulls={false} />
        <Line type="monotone" dataKey="national" stroke="#4a7aaa" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
