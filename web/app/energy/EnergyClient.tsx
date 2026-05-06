"use client";

import { useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import ChartCard from "@/components/ChartCard";
import ScopeToggle from "@/components/ScopeToggle";
import EmptyState from "@/components/EmptyState";
import { ENERGY_SOURCE_COLORS } from "@/lib/constants";
import { fmtAxisTick, fmtMonth } from "@/lib/utils";
import type { NationalEnergyRow } from "@/lib/queries";

interface Props {
  data: NationalEnergyRow[];
}

const SOURCE_MAP: Record<string, string> = {
  PAPRBUS: "petroleum",
  NGPRBUS: "natural_gas",
  CLPRBUS: "coal",
  NUETBUS: "nuclear",
  REPRBUS: "renewable",
};

const SOURCE_LABELS: Record<string, string> = {
  petroleum: "Petroleum",
  natural_gas: "Natural Gas",
  coal: "Coal",
  nuclear: "Nuclear",
  renewable: "Renewable",
};

const PRESETS = [
  { label: "All Time", value: "all" },
  { label: "Last 25 Years", value: "25y" },
  { label: "Last 10 Years", value: "10y" },
];

function getStartYear(preset: string): number {
  const now = new Date().getFullYear();
  if (preset === "25y") return now - 25;
  if (preset === "10y") return now - 10;
  return 1949;
}

export default function EnergyClient({ data }: Props) {
  const [preset, setPreset] = useState("25y");

  const startYear = getStartYear(preset);
  const startPeriod = `${startYear}-01`;

  const byPeriod = new Map<string, Record<string, unknown>>();
  for (const r of data) {
    if (r.period < startPeriod) continue;
    const source = SOURCE_MAP[r.series_id];
    if (!source) continue;
    if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period });
    byPeriod.get(r.period)![source] = r.value;
  }
  const chartData = Array.from(byPeriod.values()).sort((a, b) => (a.period as string) < (b.period as string) ? -1 : 1);
  const sources = ["petroleum", "natural_gas", "coal", "nuclear", "renewable"];

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
          active="national"
          onChange={(v) => { if (v === "states") window.location.href = "/energy/states"; }}
        />
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--blue-dark)", fontFamily: "var(--font-display)" }}>
          National Energy
        </h1>
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button key={p.value} className={`preset-btn ${preset === p.value ? "active" : ""}`}
              onClick={() => setPreset(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 && <EmptyState message="No national energy data available. Run the national_energy backfill module." />}

      {chartData.length > 0 && (
        <ChartCard
          title="U.S. Energy Production by Source"
          subtitle="Monthly, quadrillion BTU"
          source="EIA Monthly Energy Review"
        >
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ddd8ce" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={{ stroke: "#ddd8ce" }}
                interval={Math.max(Math.floor(chartData.length / 12) - 1, 0)} tickFormatter={fmtMonth}
              />
              <YAxis tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={false} tickFormatter={fmtAxisTick} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ddd8ce", borderRadius: 6, fontSize: 12 }}
                labelFormatter={(v: unknown) => fmtMonth(String(v))}
                formatter={(v: unknown, name: unknown) => [Number(v)?.toFixed(2) || "\u2014", SOURCE_LABELS[String(name)] || String(name)]}
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
