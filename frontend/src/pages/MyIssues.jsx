import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, CATEGORY_LABELS } from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";

export default function MyIssues() {
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    api.get("/issues", { params: { mine: true } }).then((r) => setIssues(r.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="uppercase-label text-cyan-400 mb-2">CITIZEN TIMELINE</div>
        <h1 className="font-heading font-bold text-4xl tracking-tighter">My Reported Issues</h1>
      </div>
      <div className="space-y-3" data-testid="my-issues-list">
        {issues.map((it) => (
          <Link key={it.id} to={`/app/issues/${it.id}`} className="glass rounded-xl p-5 flex items-center gap-5 hover:-translate-y-0.5 transition-transform" data-testid={`my-issue-row-${it.id}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={it.status} />
                <PriorityBadge priority={it.priority} />
                {it.overdue && <span className="uppercase-label text-red-400">⚠ Overdue · {it.hours_open}h</span>}
              </div>
              <div className="font-heading font-semibold text-lg">{it.title}</div>
              <div className="text-xs text-slate-400 mt-1">{it.address}</div>
            </div>
            <div className="text-right">
              <div className="uppercase-label text-cyan-400">{CATEGORY_LABELS[it.category]}</div>
              <div className="text-xs text-slate-500 font-mono-data mt-1">{new Date(it.created_at).toLocaleDateString()}</div>
            </div>
          </Link>
        ))}
        {issues.length === 0 && <div className="glass rounded-xl p-10 text-center text-slate-400">No issues yet.</div>}
      </div>
    </div>
  );
}
