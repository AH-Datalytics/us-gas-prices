/** Balancing authority regions with plain English labels */
export const BA_REGIONS = [
  { code: "US48", label: "U.S. Lower 48" },
  { code: "ERCO", label: "Texas Grid (ERCOT)" },
  { code: "CISO", label: "California Grid (CAISO)" },
  { code: "PJM", label: "Mid-Atlantic Grid (PJM)" },
  { code: "MISO", label: "Midcontinent (MISO)" },
  { code: "ISNE", label: "New England (ISO-NE)" },
  { code: "NYIS", label: "New York (NYISO)" },
  { code: "SWPP", label: "Southwest Power Pool" },
  { code: "NW", label: "Northwest" },
  { code: "SE", label: "Southeast" },
  { code: "FLA", label: "Florida" },
] as const;

/** Which states each BA primarily covers */
export const BA_STATE_MAP: Record<string, string[]> = {
  ERCO: ["TX"],
  CISO: ["CA"],
  PJM: ["PA", "NJ", "MD", "DE", "VA", "WV", "OH", "IN", "IL", "MI", "KY", "NC", "DC"],
  MISO: ["MN", "WI", "IA", "MO", "AR", "LA", "MS", "IN", "IL", "MI", "ND", "SD", "MT"],
  ISNE: ["CT", "ME", "MA", "NH", "RI", "VT"],
  NYIS: ["NY"],
  SWPP: ["KS", "OK", "NE", "SD", "ND", "NM", "TX"],
  NW: ["WA", "OR", "ID", "MT", "WY", "UT", "NV", "CO"],
  SE: ["AL", "GA", "SC", "TN", "NC", "MS"],
  FLA: ["FL"],
};

/** Reverse: state -> primary BA */
export const STATE_BA_MAP: Record<string, string> = {};
for (const [ba, states] of Object.entries(BA_STATE_MAP)) {
  for (const st of states) {
    if (!STATE_BA_MAP[st]) STATE_BA_MAP[st] = ba;
  }
}

/** Fuel type color palette */
export const FUEL_COLORS: Record<string, string> = {
  NG: "#2d5f8a",
  COL: "#4a4a4a",
  NUC: "#8b5cf6",
  WND: "#10b981",
  SUN: "#f59e0b",
  WAT: "#06b6d4",
  OIL: "#a03030",
  OTH: "#9ca3af",
};

/** Fuel type display names */
export const FUEL_NAMES: Record<string, string> = {
  NG: "Natural Gas",
  COL: "Coal",
  NUC: "Nuclear",
  WND: "Wind",
  SUN: "Solar",
  WAT: "Hydro",
  OIL: "Petroleum",
  OTH: "Other",
};

/** Energy source colors for national energy charts */
export const ENERGY_SOURCE_COLORS: Record<string, string> = {
  petroleum: "#a03030",
  natural_gas: "#2d5f8a",
  coal: "#4a4a4a",
  nuclear: "#8b5cf6",
  renewable: "#10b981",
};

/** US state abbreviations and names */
export const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];
