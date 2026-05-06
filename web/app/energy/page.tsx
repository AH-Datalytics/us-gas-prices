import { getNationalEnergy } from "@/lib/queries";
import EnergyClient from "./EnergyClient";

// Key MSN codes for production by source — will be verified after backfill
// If these don't match, check: SELECT DISTINCT series_id, series_name FROM national_energy WHERE series_id LIKE '%PRP%' OR series_id LIKE '%ETV%'
const PRODUCTION_SERIES = [
  "PAPRP",  // Petroleum production
  "NGPRP",  // Natural gas production
  "CLPRP",  // Coal production
  "NUETV",  // Nuclear electric power
  "REPRP",  // Renewable energy production
];

export default function EnergyPage() {
  const data = getNationalEnergy(PRODUCTION_SERIES, "1949-01", "2030-12");

  return <EnergyClient data={data} />;
}
