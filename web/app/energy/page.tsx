import { getNationalEnergy } from "@/lib/queries";
import EnergyClient from "./EnergyClient";

// MSN codes for production by source (Trillion Btu)
const PRODUCTION_SERIES = [
  "PAPRBUS",  // Crude Oil Production
  "NGPRBUS",  // Natural Gas (Dry) Production
  "CLPRBUS",  // Coal Production
  "NUETBUS",  // Nuclear Electric Power
  "REPRBUS",  // Total Renewable Energy Production
];

export default function EnergyPage() {
  const data = getNationalEnergy(PRODUCTION_SERIES, "1949-01", "2030-12");

  return <EnergyClient data={data} />;
}
