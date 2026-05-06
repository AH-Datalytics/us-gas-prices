import { getGasPrices } from "@/lib/queries";
import { daysAgo } from "@/lib/utils";
import CityClient from "./CityClient";

export default async function GasPriceCityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const twoYearsAgo = daysAgo(730);
  const cityData = getGasPrices("city", id, "regular_gas", twoYearsAgo);
  const nationalData = getGasPrices("national", "US", "regular_gas", twoYearsAgo);

  return <CityClient cityId={id} cityData={cityData} nationalData={nationalData} />;
}
