import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, CATEGORY_LABELS } from "@/lib/api";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import MapView from "@/components/MapView";
import { AlertTriangle, Users, BarChart3, Activity as ActivityIcon } from "lucide-react";

const CHART_COLORS = ["#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#3b82f6", "#ec4899", "#94a3b8"];

const Stat = ({ label, value, suffix = "", accent, icon: Icon, testId }) => (
  <div className="glass rounded-xl p-5" data-testid={testId}>
    <div className="flex items-center justify-between mb-3">
      <div className="uppercase-label text-slate-400">{label}</div>
      {Icon && <Icon className="w-4 h-4" style={{ color: accent }} />}
    </div>
    <div className="font-heading font-bold text-3xl tabular-nums" style={{ color: accent }}>{value}<span className="text-base ml-1 opacity-60">{suffix}</span></div>
  </div>
);

export default function SupervisorDashboard() {
  const [a, setA] = useState(null);
  const [issues, setIssues] = useState([]);

  const load = async () => {
    try {
      const [an, is] = await Promise.all([api.get("/analytics/supervisor"), api.get("/issues")]);
      setA(an.data);
      setIssues(is.data);
    } catch (e) {
      console.error("Failed to load supervisor analytics", e);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const escalated = issues.filter((i) => i.escalated);

  return (
    <div className="space-y-8">
      <div>
        <div className="uppercase-label text-emerald-400 mb-2">COMMAND CENTER</div>
        <h1 className="font-heading font-bold text-4xl md:text-5xl tracking-tighter">City-wide oversight, in real-time.</h1>
        <p className="text-slate-400 mt-2">Track SLA breaches, monitor officials, and ensure no citizen complaint slips through.</p>
      </div>

      {escalated.length > 0 && (
        <div className="rounded-xl p-4 bg-red-500/10 border border-red-500/30 flex items-center gap-4" data-testid="escalation-banner">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-red-300">{escalated.length} issue{escalated.length>1?'s':''} require immediate escalation</div>
            <div className="text-xs text-slate-400">Citizens are waiting beyond SLA. Reassign or push for resolution.</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat testId="sup-stat-total" label="Total" value={a?.total ?? "—"} accent="#06b6d4" icon={ActivityIcon} />
        <Stat testId="sup-stat-resolved" label="Resolved" value={a?.resolved ?? "—"} accent="#10b981" />
        <Stat testId="sup-stat-progress" label="In Progress" value={a?.in_progress ?? "—"} accent="#f59e0b" />
        <Stat testId="sup-stat-sla" label="SLA Breaches" value={a?.sla_breaches ?? "—"} accent="#ef4444" icon={AlertTriangle} />
        <Stat testId="sup-stat-avg" label="Avg Resolution" value={a?.avg_resolution_hours ?? "—"} suffix="h" accent="#94a3b8" />
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 glass rounded-2xl p-6">
          <div className="uppercase-label text-cyan-400 mb-2">CITY HEATMAP</div>
          <h3 className="font-heading font-bold text-2xl mb-5">Issues by location</h3>
          <MapView issues={issues} height="420px" />
        </div>
        <div className="lg:col-span-4 glass rounded-2xl p-6">
          <div className="uppercase-label text-emerald-400 mb-2">7-DAY TREND</div>
          <h3 className="font-heading font-bold text-xl mb-4">Reports inflow</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={a?.trend_7d || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" style={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "rgba(15,15,18,0.95)", border: "1px solid rgba(255,255,255,0.1)" }} />
              <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981" }} />
            </LineChart>
          </ResponsiveContainer>

          <div className="uppercase-label text-amber-400 mt-6 mb-2">CATEGORY MIX</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={(a?.category_breakdown||[]).map((c)=>({ name: CATEGORY_LABELS[c.category]||c.category, value: c.count }))} dataKey="value" innerRadius={40} outerRadius={70} stroke="#09090b">
                {(a?.category_breakdown||[]).map((c) => <Cell key={c.category} fill={CHART_COLORS[(c.category?.charCodeAt(0) || 0) % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "rgba(15,15,18,0.95)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 glass rounded-2xl p-6">
          <div className="uppercase-label text-cyan-400 mb-2 flex items-center gap-2"><Users className="w-3.5 h-3.5"/> OFFICIAL PERFORMANCE</div>
          <h3 className="font-heading font-bold text-2xl mb-5">Resolution rate by officer</h3>
          <div className="space-y-3" data-testid="official-performance">
            {(a?.official_performance || []).map((o) => (
              <div key={o.official_id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold font-mono-data flex-shrink-0" style={{ background: "linear-gradient(135deg, #06b6d4, #10b981)", color:"#000" }}>{o.name?.[0]?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium truncate">{o.name}</span>
                    <span className="font-mono-data text-cyan-400">{o.resolved}/{o.assigned}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                    <div className="h-full" style={{ width: `${o.resolution_rate}%`, background: "linear-gradient(90deg, #06b6d4, #10b981)" }}></div>
                  </div>
                </div>
                <div className="font-mono-data text-xs text-slate-400">{o.resolution_rate}%</div>
              </div>
            ))}
            {(!a || a.official_performance.length === 0) && <div className="text-sm text-slate-500">No assignments yet.</div>}
          </div>
        </div>
        <div className="lg:col-span-6 glass rounded-2xl p-6">
          <div className="uppercase-label text-emerald-400 mb-2 flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5"/> WARD BREAKDOWN</div>
          <h3 className="font-heading font-bold text-2xl mb-5">Reports per ward</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={a?.ward_breakdown || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="ward" stroke="#64748b" style={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" style={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "rgba(15,15,18,0.95)", border: "1px solid rgba(255,255,255,0.1)" }} />
              <Bar dataKey="count" fill="#06b6d4" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="font-heading font-bold text-2xl mb-4">All Issues</h2>
        <div className="space-y-3" data-testid="all-issues-list">
          {issues.slice(0, 12).map((it) => (
            <Link key={it.id} to={`/app/issues/${it.id}`} className="glass rounded-xl p-4 flex items-center gap-4 hover:-translate-y-0.5 transition-transform">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <StatusBadge status={it.status} />
                  <PriorityBadge priority={it.priority} />
                  {it.overdue && <span className="uppercase-label text-red-400">⚠ {it.hours_open}h</span>}
                </div>
                <div className="font-heading font-semibold truncate">{it.title}</div>
                <div className="text-xs text-slate-400 truncate">{it.address} · {it.assigned_official_name || "Unassigned"}</div>
              </div>
              <div className="text-right uppercase-label text-cyan-400 hidden md:block">{CATEGORY_LABELS[it.category]}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
