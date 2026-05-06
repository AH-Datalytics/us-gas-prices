import { getGasPrices, getLatestGasPrices, getSteoForecast } from "@/lib/queries";
import { daysAgo } from "@/lib/utils";
import GasPricesClient from "./GasPricesClient";

export default function GasPricesPage() {
  const twoYearsAgo = daysAgo(730);
  const nationalRegular = getGasPrices("national", "US", "regular_gas", twoYearsAgo);
  const nationalDiesel = getGasPrices("national", "US", "diesel", twoYearsAgo);
  const latestByState = getLatestGasPrices("regular_gas");
  const steoGas = getSteoForecast("MGRARUS_$");
  const steoDiesel = getSteoForecast("DSRTUUS_$");

  return (
    <GasPricesClient
      nationalRegular={nationalRegular}
      nationalDiesel={nationalDiesel}
      latestByState={latestByState}
      steoGas={steoGas}
      steoDiesel={steoDiesel}
    />
  );
}
