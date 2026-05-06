import { getStateEnergy } from "@/lib/queries";
import EnergyStatesClient from "./EnergyStatesClient";

const CONSUMPTION_SERIES = [
  "PAACB",  // Petroleum consumption
  "NGACB",  // Natural gas consumption
  "CLACB",  // Coal consumption
  "NUETB",  // Nuclear
  "TEACB",  // Total renewable
];

export default function EnergyStatesPage() {
  const defaultState = "TX";
  const data = getStateEnergy(defaultState, CONSUMPTION_SERIES);

  return <EnergyStatesClient defaultData={data} defaultState={defaultState} />;
}
