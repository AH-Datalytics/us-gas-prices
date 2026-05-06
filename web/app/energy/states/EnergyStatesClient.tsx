"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import ChartCard from "@/components/ChartCard";
import ScopeToggle from "@/components/ScopeToggle";
import EmptyState from "@/components/EmptyState";
import { US_STATES, ENERGY_SOURCE_COLORS } from "@/lib/constants";
import { fmtAxisTick, fmt } from "@/lib/utils";
import type { StateEnergyRow } from "@/lib/queries";

interface Props {
  defaultData: StateEnergyRow[];
  defaultState: string;
}

const SERIES_SOURCE: Record<string, string> = {
  PAACB: "petroleum", NGACB: "natural_gas", CLACB: "coal", NUETB: "nuclear", TEACB: "renewable",
};
const SOURCE_LABELS: Record<string, string> = {
  petroleum: "Petroleum", natural_gas: "Natural Gas", coal: "Coal", nuclear: "Nuclear", renewable: "Renewable",
};

export default function EnergyStatesClient({ defaultData, defaultState }: Props) {
  const [state, setState] = useState(defaultState);
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (state === defaultState) { setData(defaultData); return; }
    setLoading(true);
    fetch(`/api/state-energy?state=${state}`)
      .then((r) => r.json())
      .then((d) => setData(d.data || []))
      .finally(() => setLoading(false));
  }, [state, defaultState, defaultData]);

  const byYear = new Map<number, Record<string, unknown>>();
  for (const r of data) {
    const src = SERIES_SOURCE[r.series_id];
    if (!src) continue;
    if (!byYear.has(r.year)) byYear.set(r.year, { year: r.year });
    byYear.get(r.year)![src] = r.value;
  }
  const chartData = Array.from(byYear.values()).sort((a, b) => (a.year as number) - (b.year as number));
  const sources = ["petroleum", "natural_gas", "coal", "nuclear", "renewable"];
  const stateName = US_STATES.find((s) => s.code === state)?.name || state;

  return (
    <div className="max-w-6xl mx-auto px-8 py-6">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/" className="back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back
        </Link>
        <ScopeToggle
          options={[
            { value: "national", label: "National" },
            { value: "states", label: "By State" },
          ]}
          active="states"
          onChange={(v) => { if (v === "national") window.location.href = "/energy"; }}
        />
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--blue-dark)", fontFamily: "var(--font-display)" }}>
          State Energy Profile
        </h1>
        <select value={state} onChange={(e) => setState(e.target.value)}
          style={{ background: "var(--color-surface)", border: "1.5px solid var(--blue-light)", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 500, color: "var(--blue-dark)", fontFamily: "inherit" }}
        >
          {US_STATES.map((s) => (<option key={s.code} value={s.code}>{s.name}</option>))}
        </select>
      </div>

      {loading && <div className="text-center py-8" style={{ color: "var(--blue-mid)", fontSize: 13 }}>Loading...</div>}
      {!loading && chartData.length === 0 && <EmptyState message={`No energy data for ${stateName}. Run the state_energy (SEDS) backfill module.`} />}

      {!loading && chartData.length > 0 && (
        <ChartCard title={`${stateName} Energy Consumption`} subtitle="Annual, billion BTU, by source" source="EIA State Energy Data System (SEDS)">
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ddd8ce" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={{ stroke: "#ddd8ce" }}
                interval={Math.max(Math.floor(chartData.length / 12) - 1, 0)}
              />
              <YAxis tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={false} tickFormatter={fmtAxisTick} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ddd8ce", borderRadius: 6, fontSize: 12 }}
                formatter={(v: unknown, name: unknown) => [fmt(Math.round(Number(v) || 0)), SOURCE_LABELS[String(name)] || String(name)]}
              />
              {sources.map((s) => (
                <Area key={s} type="monotone" dataKey={s} stackId="1"
                  stroke={ENERGY_SOURCE_COLORS[s] || "#9ca3af"} fill={ENERGY_SOURCE_COLORS[s] || "#9ca3af"} fillOpacity={0.7}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3">
            {sources.map((s) => (
              <div key={s} className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--color-chart-text)" }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: ENERGY_SOURCE_COLORS[s] || "#9ca3af" }} />
                {SOURCE_LABELS[s]}
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
