/** Format a number with commas: 1234567 -> "1,234,567" */
export function fmt(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return n.toLocaleString("en-US");
}

/** Format MWh for display: 12345 -> "12,345 MWh", 1234567 -> "1.23 TWh" */
export function fmtMWh(mwh: number | null | undefined): string {
  if (mwh == null) return "\u2014";
  if (Math.abs(mwh) >= 1_000_000) return `${(mwh / 1_000_000).toFixed(2)} TWh`;
  if (Math.abs(mwh) >= 1_000) return `${(mwh / 1_000).toFixed(1)} GWh`;
  return `${fmt(Math.round(mwh))} MWh`;
}

/** Format axis ticks: 25000 -> "25k", 1500000 -> "1.5M" */
export function fmtAxisTick(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 10_000) return `${(v / 1_000).toLocaleString()}k`;
  return v.toLocaleString();
}

/** Format price per gallon: 3.429 -> "$3.43" (input already in dollars) */
export function fmtDollars(dollars: number | null | undefined): string {
  if (dollars == null) return "\u2014";
  return `$${dollars.toFixed(2)}`;
}

/** Format YYYY-MM to "Jan 2024" */
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(m) - 1]} ${y}`;
}

/** Format ISO hour "2026-05-06T14" to "May 6, 2 PM" */
export function fmtHour(iso: string): string {
  const match = iso.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
  if (!match) return iso;
  const [, , mo, day, hr] = match;
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = parseInt(hr);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${names[parseInt(mo) - 1]} ${parseInt(day)}, ${h12} ${ampm}`;
}

/** Compute nice round Y-axis ticks */
export function niceTicks(max: number, count = 5): number[] {
  if (max <= 0) return [0];
  const steps = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
  const raw = max / count;
  const step = steps.find((s) => s >= raw) || Math.ceil(raw / 1000000) * 1000000;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.1; v += step) ticks.push(v);
  return ticks;
}

/** Get N days ago as YYYY-MM-DD */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Get N months ago as YYYY-MM */
export function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
