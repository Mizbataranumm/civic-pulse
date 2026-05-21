import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { CATEGORY_LABELS, STATUS_COLORS } from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";

// Fix default icon import (we'll use custom anyway)
delete L.Icon.Default.prototype._getIconUrl;

const buildIcon = (status) => {
  const color = STATUS_COLORS[status]?.text || "#06b6d4";
  return L.divIcon({
    className: "civic-marker",
    html: `<div style="position:relative;width:28px;height:28px;">
      <div style="position:absolute;inset:0;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 0 14px ${color}99;border:2px solid rgba(255,255,255,0.9);"></div>
      <div style="position:absolute;left:8px;top:8px;width:12px;height:12px;background:rgba(0,0,0,0.6);border-radius:50%;"></div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};

function FitToBounds({ issues }) {
  const map = useMap();
  useEffect(() => {
    if (!issues || issues.length === 0) return;
    try {
      const bounds = L.latLngBounds(issues.map((i) => [i.latitude, i.longitude]));
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    } catch (e) {
      console.error("Failed to fit map bounds", e);
    }
  }, [issues, map]);
  return null;
}

function LocationPicker({ onPick }) {
  const map = useMap();
  useEffect(() => {
    const handler = (e) => onPick(e.latlng.lat, e.latlng.lng);
    map.on("click", handler);
    return () => map.off("click", handler);
  }, [map, onPick]);
  return null;
}

export default function MapView({ issues = [], center = [20.5937, 78.9629], zoom = 5, height = "500px", onPickLocation = null, pickedPin = null, fit = true }) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-white/10" style={{ height }}>
      <MapContainer center={center} zoom={zoom} style={{ width: "100%", height: "100%" }} scrollWheelZoom={true} data-testid="map-container">
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        {fit && <FitToBounds issues={issues} />}
        {onPickLocation && <LocationPicker onPick={onPickLocation} />}
        {issues.map((issue) => (
          <Marker key={issue.id} position={[issue.latitude, issue.longitude]} icon={buildIcon(issue.status)}>
            <Popup>
              <div className="space-y-2 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <StatusBadge status={issue.status} />
                  <PriorityBadge priority={issue.priority} />
                </div>
                <div className="font-heading font-semibold text-sm">{issue.title}</div>
                <div className="text-xs text-slate-400">{CATEGORY_LABELS[issue.category]}</div>
                <div className="text-xs text-slate-300">{issue.address}</div>
              </div>
            </Popup>
          </Marker>
        ))}
        {pickedPin && (
          <Marker position={pickedPin} icon={buildIcon("acknowledged")}>
            <Popup>New issue location</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
