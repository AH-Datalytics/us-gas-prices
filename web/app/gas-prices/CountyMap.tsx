"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fmtDollars } from "@/lib/utils";

interface CountyPrice {
  state: string;
  stateFips: string;
  county: string;
  price: number;
}

interface CountyMapProps {
  onStateClick?: (stateCode: string) => void;
}

export default function CountyMap({ onStateClick }: CountyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

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
      center: [-98.5, 39.5],
      zoom: 3.5,
      minZoom: 2,
      maxZoom: 10,
      attributionControl: false,
    });

    map.current = m;

    m.on("load", async () => {
      // Load county GeoJSON
      const geoRes = await fetch("/us-counties.json");
      const geojson = await geoRes.json();

      // Load county prices
      const priceRes = await fetch("/api/gas-counties");
      const { counties } = await priceRes.json() as { counties: CountyPrice[] };

      // Build lookup: normalize county name for matching
      const normalize = (s: string) => s.toLowerCase().replace(/saint /g, "st. ").replace(/de /g, "de").replace(/ /g, " ");
      const priceLookup = new Map<string, number>();
      for (const c of counties) {
        // Key: stateFips + normalized county name
        priceLookup.set(`${c.stateFips}_${normalize(c.county)}`, c.price);
      }

      // Inject price into GeoJSON properties
      let minPrice = Infinity, maxPrice = -Infinity;
      for (const feat of geojson.features) {
        const stateFips = feat.properties.STATE;
        const countyName = normalize(feat.properties.NAME);
        const price = priceLookup.get(`${stateFips}_${countyName}`);
        feat.properties.price = price ?? null;
        if (price != null) {
          if (price < minPrice) minPrice = price;
          if (price > maxPrice) maxPrice = price;
        }
      }

      m.addSource("counties", { type: "geojson", data: geojson });

      // County fill layer with price-based color
      m.addLayer({
        id: "county-fill",
        type: "fill",
        source: "counties",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "price"], null],
            "#d4e4f0", // no data — light gray-blue
            [
              "interpolate",
              ["linear"],
              ["get", "price"],
              minPrice, "#2d5f8a",   // low price — blue
              (minPrice + maxPrice) / 2, "#f5f0e8", // mid — cream
              maxPrice, "#a03030",   // high price — red
            ],
          ],
          "fill-opacity": 0.85,
        },
      });

      // County borders
      m.addLayer({
        id: "county-borders",
        type: "line",
        source: "counties",
        paint: {
          "line-color": "#ffffff",
          "line-width": 0.3,
          "line-opacity": 0.5,
        },
      });

      // State borders (thicker) — use same source but filter by state boundaries
      // Actually, add state outlines from the states GeoJSON
      try {
        const statesRes = await fetch("/us-states.json");
        const statesGeo = await statesRes.json();
        m.addSource("states", { type: "geojson", data: statesGeo });
        m.addLayer({
          id: "state-borders",
          type: "line",
          source: "states",
          paint: {
            "line-color": "#1a3a5c",
            "line-width": 1,
            "line-opacity": 0.6,
          },
        });
      } catch {}

      // Tooltip popup
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "county-popup",
      });

      m.on("mousemove", "county-fill", (e) => {
        if (!e.features?.length) return;
        const feat = e.features[0];
        const name = feat.properties?.NAME || "";
        const price = feat.properties?.price;
        const priceStr = price != null ? fmtDollars(price) : "No data";
        popup
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${name}</strong><br/>${priceStr}/gal`)
          .addTo(m);
        m.getCanvas().style.cursor = "pointer";
      });

      m.on("mouseleave", "county-fill", () => {
        popup.remove();
        m.getCanvas().style.cursor = "";
      });

      // Click to select state
      if (onStateClick) {
        m.on("click", "county-fill", (e) => {
          if (!e.features?.length) return;
          const stateFips = e.features[0].properties?.STATE;
          const FIPS_TO_ABBR: Record<string, string> = {
            "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
            "11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA",
            "20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN",
            "28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM",
            "36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
            "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA",
            "54":"WV","55":"WI","56":"WY",
          };
          const abbr = FIPS_TO_ABBR[stateFips];
          if (abbr) onStateClick(abbr);
        });
      }

      setLoading(false);
    });

    return () => { m.remove(); map.current = null; };
  }, [onStateClick]);

  return (
    <div style={{ position: "relative" }}>
      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, color: "var(--blue-mid)", fontSize: 12 }}>
          Loading map...
        </div>
      )}
      <div ref={mapContainer} style={{ width: "100%", height: 420, borderRadius: 4 }} />
      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 10, color: "var(--blue-mid)" }}>
        <span>Lower</span>
        <div style={{
          width: 140, height: 8, borderRadius: 4,
          background: "linear-gradient(to right, #2d5f8a, #f5f0e8, #a03030)",
        }} />
        <span>Higher</span>
        <span style={{ marginLeft: 12, color: "#d4e4f0" }}>&#9632;</span>
        <span>No data</span>
      </div>
    </div>
  );
}
