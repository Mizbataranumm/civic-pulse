import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, CATEGORY_LABELS } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { FilePlus2, MapPin, Clock, CheckCircle2 } from "lucide-react";

const StatCard = ({ label, value, icon: Icon, accent, testId }) => (
  <div className="glass rounded-xl p-5" data-testid={testId}>
    <div className="flex items-center justify-between mb-3">
      <div className="uppercase-label text-slate-400">{label}</div>
      <Icon className="w-4 h-4" style={{ color: accent }} />
    </div>
    <div className="font-heading font-bold text-3xl tabular-nums" style={{ color: accent }}>{value}</div>
  </div>
);

export default function CitizenDashboard() {
  const { user } = useAuth();
  const [myIssues, setMyIssues] = useState([]);

  useEffect(() => {
    api.get("/issues", { params: { mine: true } }).then((r) => setMyIssues(r.data)).catch(() => {});
  }, []);

  const total = myIssues.length;
  const resolved = myIssues.filter((i) => i.status === "resolved" || i.status === "closed").length;
  const inProgress = myIssues.filter((i) => i.status === "in_progress").length;
  const pending = myIssues.filter((i) => i.status === "submitted" || i.status === "acknowledged").length;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="uppercase-label text-cyan-400 mb-2">CITIZEN PANEL</div>
          <h1 className="font-heading font-bold text-4xl md:text-5xl tracking-tighter">Hi {user?.full_name?.split(" ")[0]}, your city listens.</h1>
          <p className="text-slate-400 mt-2">Spot an issue? Report it in 30 seconds with AI assistance.</p>
        </div>
        <Link to="/app/report" data-testid="citizen-report-cta">
          <Button className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold h-11 px-6">
            <FilePlus2 className="w-4 h-4 mr-1.5" /> Report New Issue
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard testId="cit-stat-total" label="Total Reports" value={total} icon={MapPin} accent="#06b6d4" />
        <StatCard testId="cit-stat-progress" label="In Progress" value={inProgress} icon={Clock} accent="#f59e0b" />
        <StatCard testId="cit-stat-pending" label="Pending" value={pending} icon={Clock} accent="#ef4444" />
        <StatCard testId="cit-stat-resolved" label="Resolved" value={resolved} icon={CheckCircle2} accent="#10b981" />
      </div>

      <div>
        <h2 className="font-heading font-bold text-2xl mb-4">Recent Activity</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="citizen-recent-issues">
          {myIssues.slice(0, 6).map((it) => (
            <Link key={it.id} to={`/app/issues/${it.id}`} className="glass rounded-xl p-5 hover:-translate-y-1 transition-transform" data-testid={`issue-card-${it.id}`}>
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={it.status} />
                <PriorityBadge priority={it.priority} />
              </div>
              <div className="font-heading font-semibold text-base mb-1.5 line-clamp-2">{it.title}</div>
              <div className="text-xs text-slate-400 line-clamp-2 mb-3">{it.address}</div>
              <div className="flex items-center justify-between">
                <div className="uppercase-label text-cyan-400">{CATEGORY_LABELS[it.category]}</div>
                {it.overdue && <span className="uppercase-label text-red-400">⚠ OVERDUE</span>}
              </div>
            </Link>
          ))}
          {myIssues.length === 0 && (
            <div className="md:col-span-3 glass rounded-xl p-10 text-center">
              <p className="text-slate-400 mb-4">You haven't reported any issues yet.</p>
              <Link to="/app/report"><Button className="bg-cyan-500 hover:bg-cyan-400 text-black" data-testid="empty-state-report-button">Report your first issue</Button></Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
