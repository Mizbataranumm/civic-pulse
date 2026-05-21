import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, CATEGORY_LABELS } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { ListChecks, AlertTriangle, CheckCircle2, Timer } from "lucide-react";

const StatCard = ({ label, value, icon: Icon, accent, testId }) => (
  <div className="glass rounded-xl p-5" data-testid={testId}>
    <div className="flex items-center justify-between mb-3">
      <div className="uppercase-label text-slate-400">{label}</div>
      <Icon className="w-4 h-4" style={{ color: accent }} />
    </div>
    <div className="font-heading font-bold text-3xl tabular-nums" style={{ color: accent }}>{value}</div>
  </div>
);

export default function OfficialDashboard() {
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    api.get("/issues", { params: { assigned: true } }).then((r) => setIssues(r.data)).catch(() => {});
  }, []);

  const assigned = issues.length;
  const overdue = issues.filter((i) => i.overdue).length;
  const today = new Date().toDateString();
  const resolvedToday = issues.filter((i) => i.resolved_at && new Date(i.resolved_at).toDateString() === today).length;
  const inProgress = issues.filter((i) => i.status === 'in_progress').length;

  return (
    <div className="space-y-8">
      <div>
        <div className="uppercase-label text-cyan-400 mb-2">OFFICIAL WORKSPACE</div>
        <h1 className="font-heading font-bold text-4xl md:text-5xl tracking-tighter">Officer {user?.full_name?.split(" ").slice(-1)[0]} — your queue</h1>
        <p className="text-slate-400 mt-2">Triage assigned issues, update status, and beat the SLA clock.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard testId="off-stat-assigned" label="Assigned" value={assigned} icon={ListChecks} accent="#06b6d4" />
        <StatCard testId="off-stat-progress" label="In Progress" value={inProgress} icon={Timer} accent="#f59e0b" />
        <StatCard testId="off-stat-overdue" label="Overdue" value={overdue} icon={AlertTriangle} accent="#ef4444" />
        <StatCard testId="off-stat-resolved-today" label="Resolved Today" value={resolvedToday} icon={CheckCircle2} accent="#10b981" />
      </div>

      <div>
        <h2 className="font-heading font-bold text-2xl mb-4">My Queue</h2>
        <div className="space-y-3" data-testid="official-queue">
          {issues.map((it) => (
            <Link key={it.id} to={`/app/issues/${it.id}`} className="glass rounded-xl p-5 flex items-center gap-5 hover:-translate-y-0.5 transition-transform" data-testid={`queue-row-${it.id}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge status={it.status} />
                  <PriorityBadge priority={it.priority} />
                  {it.overdue && <span className="uppercase-label text-red-400">⚠ {it.hours_open}h open</span>}
                </div>
                <div className="font-heading font-semibold text-lg">{it.title}</div>
                <div className="text-xs text-slate-400 mt-1">{it.address} · Reported by {it.reporter_name}</div>
              </div>
              <div className="text-right">
                <div className="uppercase-label text-cyan-400">{CATEGORY_LABELS[it.category]}</div>
                <div className="text-xs text-slate-500 font-mono-data mt-1">{new Date(it.created_at).toLocaleDateString()}</div>
              </div>
            </Link>
          ))}
          {issues.length === 0 && <div className="glass rounded-xl p-10 text-center text-slate-400">Nothing assigned. Take a breath — and check back soon.</div>}
        </div>
      </div>
    </div>
  );
}
