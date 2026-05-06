import { getStateGeneration } from "@/lib/queries";
import { monthsAgo } from "@/lib/utils";
import StatesClient from "./StatesClient";

export default function GridStatesPage() {
  const start = monthsAgo(60);
  const end = monthsAgo(0);
  const defaultState = "TX";

  const data = getStateGeneration(defaultState, start, end);

  return <StatesClient defaultData={data} defaultState={defaultState} start={start} end={end} />;
}
