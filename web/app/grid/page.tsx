import { getGridDemand, getGridFuel } from "@/lib/queries";
import GridClient from "./GridClient";

function hoursAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString().slice(0, 13);
}

export const dynamic = "force-dynamic";

export default function GridPage() {
  const start = hoursAgo(48);
  const end = hoursAgo(0);
  const defaultBa = "ERCO";

  const demand = getGridDemand(defaultBa, start, end);
  const fuel = getGridFuel(defaultBa, start, end);

  return <GridClient defaultDemand={demand} defaultFuel={fuel} defaultBa={defaultBa} defaultStart={start} defaultEnd={end} />;
}
