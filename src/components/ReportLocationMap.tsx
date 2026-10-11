"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ReportLocationMapProps {
  lat: number;
  lon: number;
  onChangeLocation: (lat: number, lon: number) => void;
}

export default function ReportLocationMap({
  lat,
  lon,
  onChangeLocation
}: ReportLocationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        attributionControl: false
      }).setView([lat, lon], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18
      }).addTo(map);

      // Custom Primary Blue Marker icon
      const pinIcon = L.divIcon({
        className: "custom-location-pin",
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: #0867C4;
            color: #FFFFFF;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 8px rgba(8, 103, 196, 0.4);
            border: 2px solid #FFFFFF;
          ">
            <div style="
              width: 10px;
              height: 10px;
              background: #FFFFFF;
              border-radius: 50%;
              transform: rotate(45deg);
            "></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });

      const marker = L.marker([lat, lon], {
        draggable: true,
        icon: pinIcon
      }).addTo(map);

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChangeLocation(Number(pos.lat.toFixed(5)), Number(pos.lng.toFixed(5)));
      });

      map.on("click", (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        onChangeLocation(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
      });

      mapRef.current = map;
      markerRef.current = marker;
    } else {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lon]);
      }
      mapRef.current.panTo([lat, lon]);
    }

    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 200);
  }, [lat, lon, onChangeLocation]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "220px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        overflow: "hidden",
        position: "relative",
        zIndex: 1,
        isolation: "isolate"
      }}
      aria-label="Interactive leak location map. Click or drag pin to set coordinates."
    />
  );
}
