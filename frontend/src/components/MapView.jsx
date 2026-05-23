import React, { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
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
      <div style="position:absolute;inset:0;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 12px ${color}77;border:2px solid rgba(255,255,255,0.98);"></div>
      <div style="position:absolute;left:8px;top:8px;width:12px;height:12px;background:#172033;border-radius:50%;"></div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};

const pickedPinIcon = L.divIcon({
  className: "civic-picked-marker",
  html: `<div style="position:relative;width:30px;height:30px;">
    <div style="position:absolute;left:50%;top:50%;width:30px;height:30px;transform:translate(-50%,-50%);border-radius:999px;background:rgba(245,158,11,0.2);box-shadow:0 0 0 10px rgba(245,158,11,0.12);"></div>
    <div style="position:absolute;inset:0;background:#f59e0b;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 14px rgba(245,158,11,0.55);border:3px solid rgba(255,255,255,0.98);"></div>
    <div style="position:absolute;left:9px;top:9px;width:12px;height:12px;background:#172033;border-radius:50%;"></div>
  </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

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

function SyncMapView({ center, zoom, pickedPin }) {
  const map = useMap();

  useEffect(() => {
    const target = pickedPin || center;
    if (!target) return;

    const [lat, lng] = target;
    const current = map.getCenter();
    const samePoint = Math.abs(current.lat - lat) < 0.00001 && Math.abs(current.lng - lng) < 0.00001;

    if (!samePoint) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), zoom), {
        animate: true,
        duration: 0.35,
      });
    }
  }, [center, map, pickedPin, zoom]);

  return null;
}

function LocationPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapView({
  issues = [],
  center = [20.5937, 78.9629],
  zoom = 5,
  height = "500px",
  onPickLocation = null,
  pickedPin = null,
  pickedPinLabel = "",
  accuracyRadius = null,
  fit = true,
}) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-white/10 bg-slate-100" style={{ height }}>
      <MapContainer center={center} zoom={zoom} style={{ width: "100%", height: "100%" }} scrollWheelZoom={true} data-testid="map-container">
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <SyncMapView center={center} zoom={zoom} pickedPin={pickedPin} />
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
          <>
            {accuracyRadius && (
              <Circle
                center={pickedPin}
                radius={accuracyRadius}
                pathOptions={{ color: "#2563eb", weight: 2, fillColor: "#3b82f6", fillOpacity: 0.12 }}
              />
            )}
            <CircleMarker
              center={pickedPin}
              radius={16}
              pathOptions={{ color: "#f59e0b", weight: 2, fillColor: "#f59e0b", fillOpacity: 0.14 }}
            />
            <Marker position={pickedPin} icon={pickedPinIcon} zIndexOffset={1000}>
              <Popup>
                <div className="max-w-[220px] text-sm">
                  <div className="font-semibold text-slate-900">Selected issue location</div>
                  {pickedPinLabel && <div className="mt-1 text-slate-600">{pickedPinLabel}</div>}
                </div>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>
      {pickedPinLabel && (
        <div className="absolute left-3 right-3 bottom-3 z-[400] rounded-md bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-md border border-slate-200">
          {pickedPinLabel}
        </div>
      )}
    </div>
  );
}
