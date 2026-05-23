import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, CATEGORY_LABELS } from "@/lib/api";
import MapView from "@/components/MapView";
import { Button } from "@/components/ui/button";
import { Crosshair, ExternalLink, Maximize2, RefreshCw } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";

export default function CityMap() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focusPoint, setFocusPoint] = useState(null);
  const [fitRequest, setFitRequest] = useState(0);
  const mapIssues = issues.filter((issue) => Number.isFinite(Number(issue.latitude)) && Number.isFinite(Number(issue.longitude)));
  const missingCoordinateCount = issues.length - mapIssues.length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/issues", { params: { _: Date.now() } });
      setIssues(data);
    } catch (e) {
      console.error("Failed to load city map issues", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="uppercase-label text-cyan-400 mb-2">CITY MAP</div>
          <h1 className="font-heading font-bold text-4xl tracking-tighter">Live civic issue map</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFitRequest(Date.now())}
            className="border-white/15 hover:bg-cyan-500/10 hover:text-cyan-300 text-xs"
          >
            <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
            Show all pins
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="border-white/15 hover:bg-cyan-500/10 hover:text-cyan-300 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:"#ef4444"}}></span>Submitted</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:"#f59e0b"}}></span>Acknowledged</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:"#06b6d4"}}></span>In Progress</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:"#10b981"}}></span>Resolved</span>
      </div>
      <MapView
        issues={mapIssues}
        height="calc(100vh - 240px)"
        syncView={false}
        focusPoint={focusPoint}
        fitRequest={fitRequest}
      />
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500 font-mono-data">
        <span>{issues.length} issues loaded · {mapIssues.length} pins on map</span>
        {missingCoordinateCount > 0 && <span className="text-amber-400">{missingCoordinateCount} missing coordinates</span>}
      </div>

      {mapIssues.length > 0 && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="uppercase-label text-cyan-400">All reports on this map</div>
            <div className="text-xs text-slate-500 font-mono-data">{mapIssues.length} visible pins</div>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
            {mapIssues.map((issue) => (
              <div key={issue.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge status={issue.status} />
                  <PriorityBadge priority={issue.priority} />
                </div>
                <div className="font-heading font-semibold text-sm truncate">{issue.title}</div>
                <div className="text-[11px] text-slate-500 mt-1 truncate">
                  {CATEGORY_LABELS[issue.category] || issue.category} - {issue.address}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFocusPoint({
                      id: issue.id,
                      lat: Number(issue.latitude),
                      lng: Number(issue.longitude),
                      zoom: 16,
                      requestedAt: Date.now(),
                    })}
                    className="h-8 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 text-xs"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    Focus
                  </Button>
                  <Link to={`/app/issues/${issue.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs text-slate-400 hover:text-cyan-300">
                    Open <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
