"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Zone } from "@/lib/data";
import { JalsetuMath } from "@/lib/math";

interface TransferRoute {
  id: string;
  fromZoneId: string;
  fromName: string;
  fromCoords: [number, number];
  toZoneId: string;
  toName: string;
  toCoords: [number, number];
  transferVolume: number;
  status: string;
}

interface InteractiveRiskMapProps {
  zones: Zone[];
  selectedZoneId?: string;
  onSelectZone: (zone: Zone) => void;
  simulationActive: boolean;
  transferRoutes: TransferRoute[];
}

export default function InteractiveRiskMap({
  zones,
  onSelectZone,
  simulationActive,
  transferRoutes
}: InteractiveRiskMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routeLayersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      // Initialize map centered at Thane metropolitan smart city coordinates
      const map = L.map(mapContainerRef.current, {
        scrollWheelZoom: false
      }).setView([19.2000, 72.9680], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(map);

      mapRef.current = map;
      routeLayersRef.current = L.layerGroup().addTo(map);
    }

    const map = mapRef.current;
    if (!map) return;

    // Clear previous non-tile layers if needed, or re-render markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Render Markers with Green, Amber, Red semantics
    zones.forEach((zone) => {
      const shortage = JalsetuMath.calculateShortage(zone.predictedDemand, zone.availableSupply);
      const risk = JalsetuMath.classifyRisk(zone.predictedDemand, zone.availableSupply);

      const colorMap = {
        High: "#D9363E",    // Red
        Medium: "#FFA94D",  // Amber
        Low: "#2B8A3E"      // Green
      };
      const markerColor = colorMap[risk] || "#2B8A3E";

      // Custom pulse/solid circle marker
      const marker = L.circleMarker(zone.coordinates, {
        radius: 14,
        fillColor: markerColor,
        color: "#FFFFFF",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(map);

      // Tooltip label always visible
      marker.bindTooltip(`<strong>${zone.name}</strong>: ${risk} Risk`, {
        permanent: true,
        direction: "top",
        offset: [0, -12],
        className: "custom-map-label"
      });

      // Interactive popup
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; line-height: 1.5; min-width: 200px;">
          <h4 style="margin: 0 0 4px 0; color: #0B1F3A; font-size: 15px;">${zone.name}</h4>
          <div style="color: #5A6B8B; font-size: 11px; margin-bottom: 6px;">${zone.displayName}</div>
          <hr style="border: 0; border-top: 1px solid #DCE5EF; margin: 6px 0;" />
          <div><strong>Predicted Demand:</strong> ${JalsetuMath.formatNumber(zone.predictedDemand)} L</div>
          <div><strong>Available Supply:</strong> ${JalsetuMath.formatNumber(zone.availableSupply)} L</div>
          <div><strong>Estimated Shortage:</strong> <span style="color: ${shortage > 0 ? '#C62828' : '#2B8A3E'}; font-weight: 700;">${JalsetuMath.formatNumber(shortage)} L</span></div>
          <div><strong>Shortage Risk:</strong> <span style="color: ${markerColor}; font-weight: 700;">${risk} Risk</span></div>
          <div style="margin-top: 8px; font-size: 11px; color: #7C8EA8; font-style: italic;">(Simulated Zone Coordinates for Municipal Demo)</div>
        </div>
      `);

      marker.on("click", () => {
        onSelectZone(zone);
      });
    });

    // Invalidate map size to prevent gray tiles
    setTimeout(() => {
      map.invalidateSize();
    }, 250);
  }, [zones, onSelectZone]);

  // Handle Simulation Route Drawing
  useEffect(() => {
    if (!mapRef.current || !routeLayersRef.current) return;
    const routeGroup = routeLayersRef.current;
    routeGroup.clearLayers();

    if (simulationActive && transferRoutes.length > 0) {
      transferRoutes.forEach((route) => {
        // Draw polyline connecting source and destination
        const polyline = L.polyline([route.fromCoords, route.toCoords], {
          color: "#0867C4",
          weight: 4,
          dashArray: "6, 8",
          opacity: 0.85
        }).addTo(routeGroup);

        // Compute midpoint for transfer volume badge
        const midLat = (route.fromCoords[0] + route.toCoords[0]) / 2;
        const midLng = (route.fromCoords[1] + route.toCoords[1]) / 2;

        const volumeIcon = L.divIcon({
          className: "route-volume-badge",
          html: `<div style="background: #012A5C; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 999px; box-shadow: 0 2px 6px rgba(0,0,0,0.25); white-space: nowrap; border: 1.5px solid #E8F3FE;">
            🔄 Transfer: ${JalsetuMath.formatNumber(route.transferVolume)} L
          </div>`,
          iconSize: [120, 24],
          iconAnchor: [60, 12]
        });

        L.marker([midLat, midLng], { icon: volumeIcon }).addTo(routeGroup);

        polyline.bindPopup(`
          <div style="font-size: 13px;">
            <strong>Proposed Transfer Route</strong><br/>
            From: <strong>${route.fromName}</strong><br/>
            To: <strong>${route.toName}</strong><br/>
            Volume: <strong style="color: #0867C4;">${JalsetuMath.formatNumber(route.transferVolume)} L</strong><br/>
            <span style="font-size: 11px; color: #5A6B8B;">${route.status}</span>
          </div>
        `);
      });
    }
  }, [simulationActive, transferRoutes]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", borderRadius: "var(--radius-md)", overflow: "hidden" }}
      />
    </div>
  );
}
