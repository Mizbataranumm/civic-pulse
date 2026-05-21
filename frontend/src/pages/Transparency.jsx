import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, CATEGORY_LABELS } from "@/lib/api";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { Activity, ArrowLeft } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import MapView from "@/components/MapView";
import { Button } from "@/components/ui/button";
import RetellOrb from "@/components/RetellOrb";

const CHART_COLORS = ["#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#3b82f6", "#ec4899", "#94a3b8"];

const Stat = ({ label, value, suffix = "", accent, testId }) => (
  <div className="glass rounded-xl p-6" data-testid={testId}>
    <div className="uppercase-label text-slate-400 mb-2">{label}</div>
    <div className="font-heading font-bold text-4xl tabular-nums" style={{ color: accent }}>
      {value}<span className="text-base ml-1 opacity-60">{suffix}</span>
    </div>
  </div>
);

export default function Transparency() {
  const [analytics, setAnalytics] = useState(null);
  const [issues, setIssues] = useState([]);

  const load = async () => {
    try {
      const [a, i] = await Promise.all([api.get("/analytics/public"), api.get("/issues/public")]);
      setAnalytics(a.data);
      setIssues(i.data);
    } catch (e) {
      console.error("Failed to load transparency data", e);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/5 glass-strong sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" data-testid="transparency-logo">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #06b6d4, #10b981)" }}>
              <Activity className="w-4 h-4 text-black" strokeWidth={2.8} />
            </div>
            <div>
              <div className="font-heading font-bold text-base">CivicPulse</div>
              <div className="uppercase-label text-slate-500 -mt-0.5">Public Transparency</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" data-testid="transparency-back-home">
              <Button variant="ghost" className="text-slate-400 hover:text-cyan-300">
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Home
              </Button>
            </Link>
            <Link to="/login" data-testid="transparency-login-link">
              <Button className="bg-cyan-500 hover:bg-cyan-400 text-black">Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-ring"></span>
            <span className="uppercase-label text-emerald-300">Live • Auto-refreshing every 12s</span>
          </div>
          <h1 className="font-heading font-bold text-4xl md:text-6xl tracking-tighter">Public Transparency<br/>Dashboard</h1>
          <p className="text-slate-400 mt-3 max-w-2xl">Every issue. Every resolution. Every SLA breach. Open to every citizen — no login required.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat testId="stat-total" label="Total Reports" value={analytics?.total ?? "—"} accent="#06b6d4" />
          <Stat testId="stat-resolved" label="Resolved" value={analytics?.resolved ?? "—"} accent="#10b981" />
          <Stat testId="stat-progress" label="In Progress" value={analytics?.in_progress ?? "—"} accent="#f59e0b" />
          <Stat testId="stat-pending" label="Pending" value={analytics?.pending ?? "—"} accent="#ef4444" />
          <Stat testId="stat-sla" label="SLA Breaches" value={analytics?.sla_breaches ?? "—"} accent="#ef4444" />
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 glass rounded-2xl p-6" data-testid="chart-trend">
            <div className="uppercase-label text-cyan-400 mb-2">7-DAY REPORT TREND</div>
            <h3 className="font-heading font-bold text-2xl mb-5">Citizen reports over the week</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={analytics?.trend_7d || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" style={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "rgba(15,15,18,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: "#06b6d4", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-5 glass rounded-2xl p-6" data-testid="chart-categories">
            <div className="uppercase-label text-emerald-400 mb-2">CATEGORY MIX</div>
            <h3 className="font-heading font-bold text-2xl mb-5">What citizens are reporting</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={(analytics?.category_breakdown || []).map((c) => ({ name: CATEGORY_LABELS[c.category] || c.category, value: c.count }))}
                  dataKey="value"
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={95}
                  stroke="#09090b" strokeWidth={2}
                >
                  {(analytics?.category_breakdown || []).map((c) => (
                    <Cell key={c.category} fill={CHART_COLORS[(c.category?.charCodeAt(0) || 0) % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(15,15,18,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 glass rounded-2xl p-6" data-testid="chart-wards">
            <div className="uppercase-label text-amber-400 mb-2">WARD PERFORMANCE</div>
            <h3 className="font-heading font-bold text-2xl mb-5">Reports by ward</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics?.ward_breakdown || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="ward" stroke="#64748b" style={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" style={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "rgba(15,15,18,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-6 glass rounded-2xl p-6" data-testid="chart-status">
            <div className="uppercase-label text-cyan-400 mb-2">RESOLUTION FUNNEL</div>
            <h3 className="font-heading font-bold text-2xl mb-5">Status distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics?.status_breakdown || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="#64748b" style={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="status" type="category" stroke="#64748b" style={{ fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ background: "rgba(15,15,18,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                <Bar dataKey="count" fill="#06b6d4" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live map */}
        <div data-testid="transparency-map">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="uppercase-label text-emerald-400 mb-2">LIVE CITY MAP</div>
              <h3 className="font-heading font-bold text-3xl">Every issue, mapped in real-time</h3>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:"#ef4444"}}></span>Submitted</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:"#f59e0b"}}></span>Acknowledged</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:"#06b6d4"}}></span>In Progress</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:"#10b981"}}></span>Resolved</span>
            </div>
          </div>
          <MapView issues={issues} height="520px" />
        </div>

        {/* Recent feed */}
        <div data-testid="transparency-recent">
          <div className="uppercase-label text-cyan-400 mb-2">RECENT REPORTS</div>
          <h3 className="font-heading font-bold text-3xl mb-5">Latest civic activity</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {issues.slice(0, 9).map((it) => (
              <div key={it.id} className="glass rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <StatusBadge status={it.status} />
                  <PriorityBadge priority={it.priority} />
                </div>
                <div className="font-heading font-semibold text-base mb-1.5 line-clamp-2">{it.title}</div>
                <div className="text-xs text-slate-400 line-clamp-2">{it.address}</div>
                <div className="uppercase-label text-cyan-400 mt-3">{CATEGORY_LABELS[it.category]}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-xs uppercase-label text-slate-500">
        © 2026 CivicPulse — Open data for a transparent city
      </footer>

      <RetellOrb />
    </div>
  );
}
