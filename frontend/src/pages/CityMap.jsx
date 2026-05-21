import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import MapView from "@/components/MapView";

export default function CityMap() {
  const [issues, setIssues] = useState([]);
  useEffect(() => {
    api.get("/issues/public").then((r) => setIssues(r.data)).catch(() => {});
  }, []);
  return (
    <div className="space-y-4">
      <div>
        <div className="uppercase-label text-cyan-400 mb-2">CITY MAP</div>
        <h1 className="font-heading font-bold text-4xl tracking-tighter">Live civic issue map</h1>
      </div>
      <div className="flex items-center gap-4 text-xs flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:"#ef4444"}}></span>Submitted</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:"#f59e0b"}}></span>Acknowledged</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:"#06b6d4"}}></span>In Progress</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:"#10b981"}}></span>Resolved</span>
      </div>
      <MapView issues={issues} height="calc(100vh - 240px)" />
    </div>
  );
}
