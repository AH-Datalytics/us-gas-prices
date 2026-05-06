"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Line,
} from "recharts";
import ChartCard from "@/components/ChartCard";
import ScopeToggle from "@/components/ScopeToggle";
import EmptyState from "@/components/EmptyState";
import { BA_REGIONS, FUEL_COLORS, FUEL_NAMES } from "@/lib/constants";
import { fmtAxisTick, fmtHour, fmtMWh, fmt } from "@/lib/utils";
import type { GridDemandRow, GridFuelRow } from "@/lib/queries";

interface Props {
  defaultDemand: GridDemandRow[];
  defaultFuel: GridFuelRow[];
  defaultBa: string;
  defaultStart: string;
  defaultEnd: string;
}

function pivotFuelData(rows: GridFuelRow[]) {
  const byPeriod = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period });
    byPeriod.get(r.period)![r.fuel_type] = r.value;
  }
  return Array.from(byPeriod.values()).sort((a, b) =>
    (a.period as string) < (b.period as string) ? -1 : 1
  );
}

function pivotDemandData(rows: GridDemandRow[]) {
  const byPeriod = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period });
    byPeriod.get(r.period)![r.type] = r.value;
  }
  return Array.from(byPeriod.values()).sort((a, b) =>
    (a.period as string) < (b.period as string) ? -1 : 1
  );
}

export default function GridClient({ defaultDemand, defaultFuel, defaultBa, defaultStart, defaultEnd }: Props) {
  const [ba, setBa] = useState(defaultBa);
  const [demand, setDemand] = useState(defaultDemand);
  const [fuel, setFuel] = useState(defaultFuel);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ba === defaultBa) {
      setDemand(defaultDemand);
      setFuel(defaultFuel);
      return;
    }
    setLoading(true);
    fetch(`/api/grid?ba=${ba}&start=${defaultStart}&end=${defaultEnd}`)
      .then((r) => r.json())
      .then((data) => {
        setDemand(data.demand || []);
        setFuel(data.fuel || []);
      })
      .finally(() => setLoading(false));
  }, [ba, defaultBa, defaultDemand, defaultFuel, defaultStart, defaultEnd]);

  const demandData = pivotDemandData(demand);
  const fuelData = pivotFuelData(fuel);
  const fuelTypes = [...new Set(fuel.map((r) => r.fuel_type))];

  // Stats
  const latestDemand = demandData[demandData.length - 1];
  const peakDemand = demandData.length > 0
    ? demandData.reduce((max, r) => ((r.D as number || 0) > (max.D as number || 0) ? r : max), demandData[0])
    : null;

  // Renewable share
  const totalGen = fuelData.reduce((s, r) => s + fuelTypes.reduce((ss, ft) => ss + ((r[ft] as number) || 0), 0), 0);
  const renewGen = fuelData.reduce((s, r) => s + (((r.WND as number) || 0) + ((r.SUN as number) || 0) + ((r.WAT as number) || 0)), 0);
  const renewPct = totalGen > 0 ? ((renewGen / totalGen) * 100).toFixed(1) : "0";

  const regionLabel = BA_REGIONS.find((r) => r.code === ba)?.label || ba;

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
          active="hourly"
          onChange={(v) => { if (v === "monthly") window.location.href = "/grid/states"; }}
        />
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--blue-dark)", fontFamily: "var(--font-display)" }}>
          Grid Monitor
        </h1>
        <select
          value={ba}
          onChange={(e) => setBa(e.target.value)}
          style={{ background: "var(--color-surface)", border: "1.5px solid var(--blue-light)", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 500, color: "var(--blue-dark)", fontFamily: "inherit" }}
        >
          {BA_REGIONS.map((r) => (
            <option key={r.code} value={r.code}>{r.label}</option>
          ))}
        </select>
      </div>

      {loading && <div className="text-center py-8" style={{ color: "var(--blue-mid)", fontSize: 13 }}>Loading {regionLabel} data...</div>}

      {!loading && demandData.length === 0 && <EmptyState message={`No hourly data available for ${regionLabel}. Run the backfill script for this region.`} />}

      {!loading && demandData.length > 0 && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="stat-box">
              <div className="stat-label">Latest Demand</div>
              <div className="stat-value">{fmtMWh(latestDemand?.D as number)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Peak Demand (48h)</div>
              <div className="stat-value">{fmtMWh(peakDemand?.D as number)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Renewable Share</div>
              <div className="stat-value">{renewPct}%</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Region</div>
              <div className="stat-value" style={{ fontSize: 16 }}>{regionLabel}</div>
            </div>
          </div>

          {/* Demand chart */}
          <ChartCard title="Demand vs. Forecast" subtitle={`${regionLabel} — hourly, megawatthours`} source="EIA Form 930">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={demandData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ddd8ce" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#5a6a7a" }} tickLine={false} axisLine={{ stroke: "#ddd8ce" }}
                  interval={Math.max(Math.floor(demandData.length / 8) - 1, 0)}
                  tickFormatter={fmtHour}
                />
                <YAxis tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={false} tickFormatter={fmtAxisTick} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ddd8ce", borderRadius: 6, fontSize: 12 }}
                  labelFormatter={(v: unknown) => fmtHour(String(v))}
                  formatter={(v: unknown, name: unknown) => [fmt(Math.round(Number(v))) + " MWh", name === "D" ? "Actual Demand" : "Forecast"]}
                />
                <Area type="monotone" dataKey="D" stroke="#2d5f8a" fill="#2d5f8a" fillOpacity={0.15} strokeWidth={2} />
                <Line type="monotone" dataKey="DF" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Generation by fuel type */}
          {fuelData.length > 0 && (
            <div className="mt-4">
              <ChartCard title="Generation by Fuel Type" subtitle={`${regionLabel} — hourly, megawatthours`} source="EIA Form 930">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={fuelData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ddd8ce" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#5a6a7a" }} tickLine={false} axisLine={{ stroke: "#ddd8ce" }}
                      interval={Math.max(Math.floor(fuelData.length / 8) - 1, 0)}
                      tickFormatter={fmtHour}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={false} tickFormatter={fmtAxisTick} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ddd8ce", borderRadius: 6, fontSize: 12 }}
                      labelFormatter={(v: unknown) => fmtHour(String(v))}
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
