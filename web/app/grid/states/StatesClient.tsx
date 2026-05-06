"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import ChartCard from "@/components/ChartCard";
import ScopeToggle from "@/components/ScopeToggle";
import EmptyState from "@/components/EmptyState";
import { US_STATES, FUEL_COLORS, FUEL_NAMES, STATE_BA_MAP, BA_REGIONS } from "@/lib/constants";
import { fmtAxisTick, fmtMonth, fmt } from "@/lib/utils";
import type { StateGenRow } from "@/lib/queries";

interface Props {
  defaultData: StateGenRow[];
  defaultState: string;
  start: string;
  end: string;
}

function pivotData(rows: StateGenRow[]) {
  const byPeriod = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period });
    byPeriod.get(r.period)![r.fuel_type] = r.generation;
  }
  return Array.from(byPeriod.values()).sort((a, b) => (a.period as string) < (b.period as string) ? -1 : 1);
}

export default function StatesClient({ defaultData, defaultState, start, end }: Props) {
  const [state, setState] = useState(defaultState);
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (state === defaultState) { setData(defaultData); return; }
    setLoading(true);
    fetch(`/api/state-generation?state=${state}&start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((d) => setData(d.data || []))
      .finally(() => setLoading(false));
  }, [state, defaultState, defaultData, start, end]);

  const chartData = pivotData(data);
  const fuelTypes = [...new Set(data.map((r) => r.fuel_type))];
  const stateName = US_STATES.find((s) => s.code === state)?.name || state;
  const baCode = STATE_BA_MAP[state];
  const baLabel = BA_REGIONS.find((r) => r.code === baCode)?.label;

  return (
    <div className="max-w-6xl mx-auto px-8 py-6">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/" className="back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back
        </Link>
        <ScopeToggle
          options={[
            { value: "hourly", label: "Live Grid (Hourly)" },
            { value: "monthly", label: "State Generation (Monthly)" },
          ]}
          active="monthly"
          onChange={(v) => { if (v === "hourly") window.location.href = "/grid"; }}
        />
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--blue-dark)", fontFamily: "var(--font-display)" }}>
          State Generation
        </h1>
        <select value={state} onChange={(e) => setState(e.target.value)}
          style={{ background: "var(--color-surface)", border: "1.5px solid var(--blue-light)", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 500, color: "var(--blue-dark)", fontFamily: "inherit" }}
        >
          {US_STATES.map((s) => (<option key={s.code} value={s.code}>{s.name}</option>))}
        </select>
      </div>

      {baCode && baLabel && (
        <div className="info-callout mb-4">
          {stateName} is primarily served by <strong>{baLabel}</strong>.{" "}
          <Link href="/grid">View live hourly data &rarr;</Link>
        </div>
      )}

      {loading && <div className="text-center py-8" style={{ color: "var(--blue-mid)", fontSize: 13 }}>Loading...</div>}
      {!loading && chartData.length === 0 && <EmptyState message={`No generation data for ${stateName}. Run the state_generation backfill module.`} />}

      {!loading && chartData.length > 0 && (
        <ChartCard title={`${stateName} Electricity Generation`} subtitle="Monthly, by fuel source" source="EIA Form 923">
          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ddd8ce" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={{ stroke: "#ddd8ce" }}
                interval={Math.max(Math.floor(chartData.length / 12) - 1, 0)} tickFormatter={fmtMonth}
              />
              <YAxis tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={false} tickFormatter={fmtAxisTick} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ddd8ce", borderRadius: 6, fontSize: 12 }}
                labelFormatter={(v: unknown) => fmtMonth(String(v))}
                formatter={(v: unknown, name: unknown) => [fmt(Math.round(Number(v))) + " MWh", FUEL_NAMES[String(name)] || String(name)]}
              />
              {fuelTypes.map((ft) => (
                <Area key={ft} type="monotone" dataKey={ft} stackId="1"
                  stroke={FUEL_COLORS[ft] || "#9ca3af"} fill={FUEL_COLORS[ft] || "#9ca3af"} fillOpacity={0.7}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3">
            {fuelTypes.map((ft) => (
              <div key={ft} className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--color-chart-text)" }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: FUEL_COLORS[ft] || "#9ca3af" }} />
                {FUEL_NAMES[ft] || ft}
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
