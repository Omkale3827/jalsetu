"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Zone, CitizenReport } from "@/lib/data";
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
  reports?: CitizenReport[];
  selectedZoneId?: string;
  onSelectZone: (zone: Zone) => void;
  simulationActive: boolean;
  transferRoutes: TransferRoute[];
}

export default function InteractiveRiskMap({
  zones,
  reports = [],
  onSelectZone,
  simulationActive,
  transferRoutes
}: InteractiveRiskMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routeLayersRef = useRef<L.LayerGroup | null>(null);
  const reportLayersRef = useRef<L.LayerGroup | null>(null);

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
      reportLayersRef.current = L.layerGroup().addTo(map);
    }

    const map = mapRef.current;
    if (!map) return;

    // Clear previous non-tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker || (layer instanceof L.Marker && !(routeLayersRef.current?.hasLayer(layer)))) {
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

      // Find any citizen reports in this zone
      const zoneReports = reports.filter((r) => r.zoneId === zone.id || (Math.hypot(r.lat - zone.coordinates[0], r.lon - zone.coordinates[1]) < 0.02));
      const burstReport = zoneReports.find((r) => r.category === "burst_pipe");

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

      // Interactive popup with supporting evidence
      const supportingEvidenceHtml = burstReport && zone.anomaly.detected
        ? `<div style="background: #FDF5F8; border-left: 3px solid #C62828; padding: 6px 8px; margin-top: 8px; font-size: 11px; color: #9B1C2C; border-radius: 2px;">
            <strong>Supporting Evidence:</strong> Active citizen burst-pipe report logged (${burstReport.id}) confirms root cause for demand surge flag!
           </div>`
        : "";

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; line-height: 1.5; min-width: 220px;">
          <h4 style="margin: 0 0 4px 0; color: #0B1F3A; font-size: 15px;">${zone.name}</h4>
          <div style="color: #5A6B8B; font-size: 11px; margin-bottom: 6px;">${zone.displayName}</div>
          <hr style="border: 0; border-top: 1px solid #DCE5EF; margin: 6px 0;" />
          <div><strong>Predicted Demand:</strong> ${JalsetuMath.formatNumber(zone.predictedDemand)} L</div>
          <div><strong>Available Supply:</strong> ${JalsetuMath.formatNumber(zone.availableSupply)} L</div>
          <div><strong>Estimated Shortage:</strong> <span style="color: ${shortage > 0 ? '#C62828' : '#2B8A3E'}; font-weight: 700;">${JalsetuMath.formatNumber(shortage)} L</span></div>
          <div><strong>Shortage Risk:</strong> <span style="color: ${markerColor}; font-weight: 700;">${risk} Risk</span></div>
          ${supportingEvidenceHtml}
          <div style="margin-top: 8px; font-size: 11px; color: #7C8EA8; font-style: italic;">(Simulated Zone Coordinates for Municipal Demo)</div>
        </div>
      `);

      marker.on("click", () => {
        onSelectZone(zone);
      });
    });

    // Render Citizen Wastage Report Pins on Map
    if (reports && reports.length > 0) {
      reports.forEach((report) => {
        const isBurst = report.category === "burst_pipe";
        const reportPinIcon = L.divIcon({
          className: "report-map-pin",
          html: `
            <div style="
              background: ${isBurst ? '#C62828' : '#0867C4'};
              color: #FFFFFF;
              width: 26px;
              height: 26px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              border: 2px solid #FFFFFF;
              cursor: pointer;
            ">
              ${isBurst ? '💥' : '💧'}
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const reportMarker = L.marker([report.lat, report.lon], { icon: reportPinIcon }).addTo(map);

        reportMarker.bindPopup(`
          <div style="font-size: 13px; line-height: 1.5; min-width: 210px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-weight: 700; color: #C62828; font-size: 12px; text-transform: uppercase;">Citizen Wastage Pin</span>
              <span style="font-size: 10px; background: #E8F3FE; color: #0867C4; padding: 2px 6px; border-radius: 999px; font-weight: 600;">${report.status}</span>
            </div>
            <div><strong>Report ID:</strong> <span style="font-family: monospace; font-weight: 700;">${report.id}</span></div>
            <div><strong>Category:</strong> ${report.category.replace('_', ' ').toUpperCase()}</div>
            <div><strong>Severity:</strong> ${report.severity?.toUpperCase() || 'MODERATE'}</div>
            ${report.addressText ? `<div style="font-size: 11px; color: #5A6B8B; margin: 4px 0;"><strong>Near:</strong> ${report.addressText}</div>` : ''}
            <div style="font-size: 12px; margin-top: 4px; background: #F7FAFB; padding: 4px 6px; border-radius: 4px;">${report.description}</div>
            <div style="font-size: 10px; color: #0867C4; margin-top: 6px; font-weight: 600;">Authority: MCD Water Board</div>
          </div>
        `);
      });
    }

    // Invalidate map size to prevent gray tiles
    setTimeout(() => {
      map.invalidateSize();
    }, 250);
  }, [zones, reports, onSelectZone]);

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
    <div style={{ position: "relative", width: "100%", height: "100%", zIndex: 1, isolation: "isolate" }}>
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", borderRadius: "var(--radius-md)", overflow: "hidden", position: "relative", zIndex: 1 }}
      />
    </div>
  );
}
