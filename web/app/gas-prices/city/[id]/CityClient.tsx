"use client";

import Link from "next/link";
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import ChartCard from "@/components/ChartCard";
import EmptyState from "@/components/EmptyState";
import type { GasPriceRow } from "@/lib/queries";
import { fmtMonth } from "@/lib/utils";

interface Props {
  cityId: string;
  cityData: GasPriceRow[];
  nationalData: GasPriceRow[];
}

export default function CityClient({ cityId, cityData, nationalData }: Props) {
  if (cityData.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-8 py-6">
        <Link href="/gas-prices" className="back-link mb-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Gas Prices
        </Link>
        <EmptyState message={`No price data available for "${cityId}"`} />
      </div>
    );
  }

  const cityName = cityData[0]?.area_name || cityId;
  const nationalMap = new Map(nationalData.map((r) => [r.period, r.price]));
  const chartData = cityData.map((r) => ({
    period: r.period,
    city: r.price,
    national: nationalMap.get(r.period) ?? null,
  }));

  return (
    <div className="max-w-5xl mx-auto px-8 py-6">
      <Link href="/gas-prices" className="back-link mb-4">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Gas Prices
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--blue-dark)", fontFamily: "var(--font-display)", marginBottom: 16, marginTop: 8 }}>
        {cityName}
      </h1>
      <ChartCard title={`${cityName} vs. National Average`} subtitle="Weekly, dollars per gallon" source="EIA">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd8ce" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={{ stroke: "#ddd8ce" }}
              interval={Math.max(Math.floor(chartData.length / 10) - 1, 0)}
              tickFormatter={(v: string) => { const p = v.split("-"); return fmtMonth(`${p[0]}-${p[1]}`); }}
            />
            <YAxis tick={{ fontSize: 11, fill: "#5a6a7a" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(2)}`} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ddd8ce", borderRadius: 6, fontSize: 12 }}
              formatter={(value: unknown, name: unknown) => [`$${Number(value).toFixed(3)}`, name === "city" ? cityName : "National Avg"]}
              labelFormatter={(label: unknown) => String(label)}
            />
            <Line type="monotone" dataKey="city" stroke="#a03030" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="national" stroke="#4a7aaa" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
