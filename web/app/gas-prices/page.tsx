import { getGasPrices, getSteoForecast, getAaaStatePrices } from "@/lib/queries";
import { daysAgo } from "@/lib/utils";
import GasPricesClient from "./GasPricesClient";

export default function GasPricesPage() {
  const twoYearsAgo = daysAgo(730);
  const nationalRegular = getGasPrices("national", "US", "regular_gas", twoYearsAgo);
  const nationalDiesel = getGasPrices("national", "US", "diesel", twoYearsAgo);
  const steoGas = getSteoForecast("MGRARUS_$");
  const steoDiesel = getSteoForecast("DSRTUUS_$");
  const aaaStates = getAaaStatePrices();

  return (
    <GasPricesClient
      nationalRegular={nationalRegular}
      nationalDiesel={nationalDiesel}
      steoGas={steoGas}
      steoDiesel={steoDiesel}
      aaaStates={aaaStates}
    />
  );
}
