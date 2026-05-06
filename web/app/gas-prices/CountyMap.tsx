"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fmtDollars } from "@/lib/utils";
import type { AaaStateRow } from "@/lib/queries";

interface CountyPrice {
  state: string;
  stateFips: string;
  county: string;
  price: number;
}

const STATE_FIPS: Record<string, string> = {
  AL:"01",AK:"02",AZ:"04",AR:"05",CA:"06",CO:"08",CT:"09",DE:"10",
  DC:"11",FL:"12",GA:"13",HI:"15",ID:"16",IL:"17",IN:"18",IA:"19",
  KS:"20",KY:"21",LA:"22",ME:"23",MD:"24",MA:"25",MI:"26",MN:"27",
  MS:"28",MO:"29",MT:"30",NE:"31",NV:"32",NH:"33",NJ:"34",NM:"35",
  NY:"36",NC:"37",ND:"38",OH:"39",OK:"40",OR:"41",PA:"42",RI:"44",
  SC:"45",SD:"46",TN:"47",TX:"48",UT:"49",VT:"50",VA:"51",WA:"53",
  WV:"54",WI:"55",WY:"56",
};

interface CountyMapProps {
  aaaStates: AaaStateRow[];
  onStateClick?: (stateCode: string) => void;
}

export default function CountyMap({ aaaStates, onStateClick }: CountyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<"state" | "county">("state");
  const levelRef = useRef(level);
  levelRef.current = level;
  const aaaStatesRef = useRef(aaaStates);
  aaaStatesRef.current = aaaStates;
  const onStateClickRef = useRef(onStateClick);
  onStateClickRef.current = onStateClick;

  useEffect(() => {
    if (!mapContainer.current) return;
    // Clean up any existing map
    if (map.current) { map.current.remove(); map.current = null; }

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [{
          id: "background",
          type: "background",
          paint: { "background-color": "#e8f0f8" },
        }],
      },
      bounds: [[-130, 22], [-62, 52]],
      fitBoundsOptions: { padding: 20 },
      minZoom: 2,
      maxZoom: 10,
      attributionControl: false,
    });

    map.current = m;

    m.on("load", async () => {
      // ─── Load state GeoJSON ───
      const statesRes = await fetch("/us-states.json");
      const statesGeo = await statesRes.json();

      // Inject state prices
      const statePriceMap = new Map<string, number>();
      for (const s of aaaStatesRef.current) {
        statePriceMap.set(s.state_name, s.regular ?? 0);
      }
      const statePrices = aaaStatesRef.current.filter((s) => s.regular != null).map((s) => s.regular!).sort((a, b) => a - b);
      const sp10 = statePrices[Math.floor(statePrices.length * 0.1)] || 0;
      const sp30 = statePrices[Math.floor(statePrices.length * 0.3)] || 0;
      const sp50 = statePrices[Math.floor(statePrices.length * 0.5)] || 0;
      const sp70 = statePrices[Math.floor(statePrices.length * 0.7)] || 0;
      const sp90 = statePrices[Math.floor(statePrices.length * 0.9)] || 0;

      for (const feat of statesGeo.features) {
        const name = feat.properties.name;
        feat.properties.price = statePriceMap.get(name) ?? null;
      }

      m.addSource("states", { type: "geojson", data: statesGeo });

      // State fill
      m.addLayer({
        id: "state-fill",
        type: "fill",
        source: "states",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "price"], null], "#ffffff",
            ["interpolate", ["linear"], ["get", "price"],
              sp10, "#2d5f8a", sp30, "#6a9bc4", sp50, "#f5f0e8", sp70, "#d4826a", sp90, "#a03030",
            ],
          ],
          "fill-opacity": 0.85,
        },
        layout: { visibility: "visible" },
      });

      // State borders (always visible)
      m.addLayer({
        id: "state-borders",
        type: "line",
        source: "states",
        paint: { "line-color": "#1a3a5c", "line-width": 1, "line-opacity": 0.6 },
      });

      // ─── Load county GeoJSON ───
      const geoRes = await fetch("/us-counties.json");
      const geojson = await geoRes.json();

      const priceRes = await fetch("/api/gas-counties");
      const { counties } = await priceRes.json() as { counties: CountyPrice[] };

      const normalize = (s: string) => s.toLowerCase().replace(/saint /g, "st. ").replace(/de /g, "de");
      const priceLookup = new Map<string, number>();
      for (const c of counties) {
        priceLookup.set(`${c.stateFips}_${normalize(c.county)}`, c.price);
      }

      const countyPrices: number[] = [];
      for (const feat of geojson.features) {
        const stateFips = feat.properties.STATE;
        const countyName = normalize(feat.properties.NAME);
        const price = priceLookup.get(`${stateFips}_${countyName}`);
        feat.properties.price = price ?? null;
        if (price != null) countyPrices.push(price);
      }
      countyPrices.sort((a, b) => a - b);

      const cp10 = countyPrices[Math.floor(countyPrices.length * 0.1)] || 0;
      const cp30 = countyPrices[Math.floor(countyPrices.length * 0.3)] || 0;
      const cp50 = countyPrices[Math.floor(countyPrices.length * 0.5)] || 0;
      const cp70 = countyPrices[Math.floor(countyPrices.length * 0.7)] || 0;
      const cp90 = countyPrices[Math.floor(countyPrices.length * 0.9)] || 0;

      m.addSource("counties", { type: "geojson", data: geojson });

      // County fill
      m.addLayer({
        id: "county-fill",
        type: "fill",
        source: "counties",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "price"], null], "#ffffff",
            ["interpolate", ["linear"], ["get", "price"],
              cp10, "#2d5f8a", cp30, "#6a9bc4", cp50, "#f5f0e8", cp70, "#d4826a", cp90, "#a03030",
            ],
          ],
          "fill-opacity": 0.85,
        },
        layout: { visibility: "none" },
      });

      // County borders
      m.addLayer({
        id: "county-borders",
        type: "line",
        source: "counties",
        paint: { "line-color": "#ffffff", "line-width": 0.3, "line-opacity": 0.5 },
        layout: { visibility: "none" },
      });

      // Move state borders on top
      m.moveLayer("state-borders");

      // ─── Tooltip ───
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

      m.on("mousemove", "county-fill", (e) => {
        if (levelRef.current !== "county" || !e.features?.length) return;
        const feat = e.features[0];
        const price = feat.properties?.price;
        popup.setLngLat(e.lngLat)
          .setHTML(`<strong>${feat.properties?.NAME || ""}</strong><br/>${price != null ? fmtDollars(price) + "/gal" : "No data"}`)
          .addTo(m);
        m.getCanvas().style.cursor = "pointer";
      });

      m.on("mousemove", "state-fill", (e) => {
        if (levelRef.current !== "state" || !e.features?.length) return;
        const feat = e.features[0];
        const price = feat.properties?.price;
        popup.setLngLat(e.lngLat)
          .setHTML(`<strong>${feat.properties?.name || ""}</strong><br/>${price != null ? fmtDollars(price) + "/gal" : "No data"}`)
          .addTo(m);
        m.getCanvas().style.cursor = "pointer";
      });

      m.on("mouseleave", "county-fill", () => { popup.remove(); m.getCanvas().style.cursor = ""; });
      m.on("mouseleave", "state-fill", () => { popup.remove(); m.getCanvas().style.cursor = ""; });

      // Click
      m.on("click", "county-fill", (e) => {
        if (!onStateClickRef.current || !e.features?.length) return;
        const stateFips = e.features[0].properties?.STATE;
        const FIPS_TO_ABBR: Record<string, string> = Object.fromEntries(
          Object.entries(STATE_FIPS).map(([k, v]) => [v, k])
        );
        const abbr = FIPS_TO_ABBR[stateFips];
        if (abbr) onStateClickRef.current?.(abbr);
      });

      m.on("click", "state-fill", (e) => {
        if (!onStateClickRef.current || !e.features?.length) return;
        const name = e.features[0].properties?.name;
        const match = aaaStatesRef.current.find((s) => s.state_name === name);
        if (match) onStateClickRef.current?.(match.state);
      });

      setLoading(false);
    });

    return () => { m.remove(); map.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle layer visibility when level changes
  useEffect(() => {
    const m = map.current;
    if (!m || !m.isStyleLoaded()) return;

    try {
      if (level === "county") {
        m.setLayoutProperty("county-fill", "visibility", "visible");
        m.setLayoutProperty("county-borders", "visibility", "visible");
        m.setLayoutProperty("state-fill", "visibility", "none");
      } else {
        m.setLayoutProperty("county-fill", "visibility", "none");
        m.setLayoutProperty("county-borders", "visibility", "none");
        m.setLayoutProperty("state-fill", "visibility", "visible");
      }
    } catch {
      // layers may not exist yet
    }
  }, [level]);

  return (
    <div style={{ position: "relative" }}>
      {/* Level toggle */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <div className="scope-toggle">
          <button className={`scope-btn ${level === "state" ? "active" : ""}`} onClick={() => setLevel("state")}>
            State
          </button>
          <button className={`scope-btn ${level === "county" ? "active" : ""}`} onClick={() => setLevel("county")}>
            County
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ position: "absolute", inset: 0, top: 36, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, color: "var(--blue-mid)", fontSize: 12 }}>
          Loading map...
        </div>
      )}
      <div ref={mapContainer} style={{ width: "100%", height: 340, borderRadius: 4 }} />
      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 10, color: "var(--blue-mid)" }}>
        <span>Lower</span>
        <div style={{
          width: 140, height: 8, borderRadius: 4,
          background: "linear-gradient(to right, #2d5f8a, #6a9bc4, #f5f0e8, #d4826a, #a03030)",
        }} />
        <span>Higher</span>
        <span style={{ marginLeft: 12, color: "#ccc", WebkitTextStroke: "0.5px #999" }}>&#9632;</span>
        <span>No data</span>
      </div>
    </div>
  );
}
