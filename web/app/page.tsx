import { getGasPrices, getSteoForecast, getAaaStatePrices, getCpi } from "@/lib/queries";
import GasPricesClient from "./GasPricesClient";

export default function GasPricesPage() {
  // Full history — client-side filtering
  const nationalRegular = getGasPrices("national", "US", "regular_gas");
  const nationalDiesel = getGasPrices("national", "US", "diesel");
  const steoGas = getSteoForecast("MGRARUS_$");
  const steoDiesel = getSteoForecast("DSRTUUS_$");
  const aaaStates = getAaaStatePrices();
  const cpi = getCpi();

  return (
    <GasPricesClient
      nationalRegular={nationalRegular}
      nationalDiesel={nationalDiesel}
      steoGas={steoGas}
      steoDiesel={steoDiesel}
      aaaStates={aaaStates}
      cpi={cpi}
    />
  );
}
