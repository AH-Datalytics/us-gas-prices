import { getGasPrices, getCitiesForState, getSteoForecast } from "@/lib/queries";
import { daysAgo } from "@/lib/utils";
import { US_STATES } from "@/lib/constants";
import StateClient from "./StateClient";

export default async function GasPriceStatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stateCode = id.toUpperCase();
  const stateInfo = US_STATES.find((s) => s.code === stateCode);
  const twoYearsAgo = daysAgo(730);

  const stateRegular = getGasPrices("state", stateCode, "regular_gas", twoYearsAgo);
  const stateDiesel = getGasPrices("state", stateCode, "diesel", twoYearsAgo);
  const nationalRegular = getGasPrices("national", "US", "regular_gas", twoYearsAgo);
  const nationalDiesel = getGasPrices("national", "US", "diesel", twoYearsAgo);
  const cities = getCitiesForState(stateCode, "regular_gas");
  const steoGas = getSteoForecast("MGRARUS_$");

  return (
    <StateClient
      stateId={stateCode}
      stateName={stateInfo?.name || stateCode}
      stateRegular={stateRegular}
      stateDiesel={stateDiesel}
      nationalRegular={nationalRegular}
      nationalDiesel={nationalDiesel}
      cities={cities}
      steoGas={steoGas}
    />
  );
}
