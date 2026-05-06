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

interface CountyInfo {
  county: string;
  price: number;
}

interface CountyMapProps {
  aaaStates: AaaStateRow[];
  onStateClick?: (stateCode: string) => void;
  selectedState?: string;
  countyData?: CountyInfo[];
  nationalAvg?: number;
}

export default function CountyMap({ aaaStates, onStateClick, selectedState, countyData = [], nationalAvg = 0 }: CountyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const countyGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<"state" | "county">("state");
  const [showPanel, setShowPanel] = useState(true);
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
      // @ts-expect-error — preserveDrawingBuffer needed for JPEG export
      preserveDrawingBuffer: true,
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

      countyGeoRef.current = geojson;
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

  // Zoom to selected state + switch to county view
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    if (!selectedState) {
      // Zoom back out
      m.fitBounds([[-130, 22], [-62, 52]], { padding: 20, duration: 800 });
      setLevel("state");
      try { m.setPaintProperty("state-borders", "line-width", 1); } catch {}
      return;
    }

    // Switch to county view + thicken state borders
    setLevel("county");
    setShowPanel(true);
    try { m.setPaintProperty("state-borders", "line-width", 2.5); } catch {}

    // Find state FIPS and zoom to its bounds
    const fips = STATE_FIPS[selectedState];
    if (!fips || !countyGeoRef.current) return;

    const stateFeatures = countyGeoRef.current.features.filter(
      (f) => f.properties?.STATE === fips
    );
    if (stateFeatures.length === 0) return;

    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    for (const feat of stateFeatures) {
      const geom = feat.geometry;
      const rings = geom.type === "Polygon"
        ? geom.coordinates
        : geom.type === "MultiPolygon"
        ? geom.coordinates.flat()
        : [];
      for (const ring of rings) {
        for (const coord of ring as [number, number][]) {
          if (coord[0] < minLng) minLng = coord[0];
          if (coord[0] > maxLng) maxLng = coord[0];
          if (coord[1] < minLat) minLat = coord[1];
          if (coord[1] > maxLat) maxLat = coord[1];
        }
      }
    }
    if (minLng < maxLng && minLat < maxLat) {
      // Offset padding: more on the right to account for the info panel (200px wide)
      m.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
        padding: { top: 30, bottom: 30, left: 30, right: 220 },
        duration: 800,
      });
    }
  }, [selectedState]);

  return (
    <div style={{ position: "relative" }}>
      {/* Controls row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        {selectedState ? (
          <button
            onClick={() => onStateClickRef.current?.("")}
            style={{ fontSize: 11, fontWeight: 600, color: "var(--blue-main)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to US
          </button>
        ) : <div />}
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
      <div style={{ position: "relative" }}>
        <div ref={mapContainer} style={{ width: "100%", height: 300, borderRadius: 4 }} />

        {/* Show/hide panel button */}
        {selectedState && countyData.length > 0 && !showPanel && (
          <button
            onClick={() => setShowPanel(true)}
            style={{
              position: "absolute", top: 8, right: 8, zIndex: 20,
              background: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)",
              border: "1px solid var(--border)", borderRadius: 4,
              padding: "3px 8px", fontSize: 9, fontWeight: 600,
              color: "var(--blue-main)", cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 1px 4px rgba(26,58,92,0.12)",
            }}
          >
            Show details
          </button>
        )}

        {/* Floating info card — right side */}
        {selectedState && countyData.length > 0 && showPanel && (() => {
          const stateAaa = aaaStates.find((s) => s.state === selectedState);
          const stateName = stateAaa?.state_name || selectedState;
          const countyLabel = selectedState === "LA" ? "parishes" : selectedState === "AK" ? "boroughs/areas" : "counties";
          return (
            <div style={{
              position: "absolute", top: 6, right: 6, bottom: 6, zIndex: 20,
              background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
              border: "1px solid var(--border)", borderLeft: "3px solid var(--blue-main)",
              borderRadius: 6, padding: "8px 10px", width: 200,
              boxShadow: "0 2px 12px rgba(26,58,92,0.15)",
              animation: "card-in 0.25s ease both",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--blue-dark)" }}>{stateName}</span>
                <button onClick={() => setShowPanel(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 9, fontWeight: 600, color: "var(--blue-main)", fontFamily: "inherit", padding: 0 }}>
                  Hide
                </button>
              </div>
              {stateAaa && (() => {
                const diff = nationalAvg > 0 ? ((stateAaa.regular! - nationalAvg) / nationalAvg) * 100 : 0;
                const absDiff = Math.abs(diff);
                return (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "var(--blue-main)", fontFamily: "var(--font-display)" }}>
                      {fmtDollars(stateAaa.regular)}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 500, color: "var(--blue-mid)", marginLeft: 3 }}>/gal</span>
                    {diff !== 0 && (
                      <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 6, color: diff > 0 ? "#a03030" : "#10b981" }}>
                        {diff > 0 ? "+" : "-"}{absDiff.toFixed(1)}% vs nat'l
                      </span>
                    )}
                  </div>
                );
              })()}
              <div style={{ fontSize: 8, fontWeight: 600, color: "var(--blue-mid)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>
                {countyData.length} {countyLabel}
              </div>
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                {countyData.map((c, i) => (
                  <div key={c.county} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "1.5px 2px", fontSize: 9, borderBottom: i < countyData.length - 1 ? "1px solid rgba(212,228,240,0.5)" : "none",
                  }}>
                    <span style={{ color: "var(--blue-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 4 }}>{c.county}</span>
                    <span style={{
                      fontWeight: 600, fontVariantNumeric: "tabular-nums", flexShrink: 0,
                      color: i === 0 ? "#a03030" : i === countyData.length - 1 ? "#10b981" : "var(--color-chart-text)",
                    }}>{fmtDollars(c.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
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
