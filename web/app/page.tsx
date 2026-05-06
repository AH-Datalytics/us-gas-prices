import ModuleCard from "@/components/ModuleCard";
import { cachedPrepare } from "@/lib/db";

function getLatestNationalGasPrice(): string {
  try {
    const row = cachedPrepare(
      "SELECT price FROM gas_prices WHERE area_type = 'national' AND product = 'regular_gas' ORDER BY period DESC LIMIT 1"
    ).get() as { price: number } | undefined;
    if (row) return `$${row.price.toFixed(2)}`;
  } catch {
    // DB may not be populated yet
  }
  return "\u2014";
}

export default function HomePage() {
  const gasPrice = getLatestNationalGasPrice();

  return (
    <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 60px)" }}>
      <div className="w-full max-w-4xl px-8 py-12">
        <div className="text-center mb-10">
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--blue-dark)", fontFamily: "var(--font-display)" }}>
            Explore U.S. Energy Data
          </h1>
          <p style={{ fontSize: 14, color: "var(--blue-mid)", marginTop: 6 }}>
            Real-time grid operations, national energy trends, and fuel prices — powered by the EIA open data API.
          </p>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <ModuleCard
            href="/grid"
            title="Grid Monitor"
            subtitle="Hourly + Monthly · 2019–present"
            stat="Hourly"
            statLabel="grid data from 11 regions"
            description="Track electricity demand, generation by fuel type, and power flows across major U.S. grid operators. See what's powering the grid right now."
            color="#2d5f8a"
            icon="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
            delay={0}
          />
          <ModuleCard
            href="/energy"
            title="National Energy"
            subtitle="Monthly & Annual · 1949–present"
            stat="75+ yrs"
            statLabel="of energy data"
            description="How the U.S. produces and consumes energy — petroleum, gas, coal, nuclear, and renewables. National trends and state-level profiles."
            color="#10b981"
            icon="M3 12l2-2 3 3 5-6 4 4"
            delay={60}
          />
          <ModuleCard
            href="/gas-prices"
            title="Gas Prices"
            subtitle="Weekly · Full history + 18mo forecast"
            stat={gasPrice}
            statLabel="per gallon national avg"
            description="Current gasoline and diesel prices by state and city. Compare to national averages and see where the government projects prices are heading."
            color="#a03030"
            icon="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
            delay={120}
          />
        </div>
      </div>
    </div>
  );
}
