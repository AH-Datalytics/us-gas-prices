import ModuleCard from "@/components/ModuleCard";

export default function HomePage() {
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
            description="Hourly electricity demand, generation by fuel type, and power flows across U.S. grids"
            gradient="linear-gradient(135deg, #1a3a5c 0%, #2d5f8a 50%, #4a7aaa 100%)"
            delay={0}
          />
          <ModuleCard
            href="/energy"
            title="National Energy"
            description="U.S. energy production, consumption, and emissions since 1949"
            gradient="linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)"
            delay={60}
          />
          <ModuleCard
            href="/gas-prices"
            title="Gas Prices"
            description="Gasoline and diesel prices by state and city, with 18-month forecasts"
            gradient="linear-gradient(135deg, #a03030 0%, #dc2626 50%, #b91c1c 100%)"
            delay={120}
          />
        </div>
      </div>
    </div>
  );
}
