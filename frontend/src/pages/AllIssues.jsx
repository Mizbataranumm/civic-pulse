import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, CATEGORY_LABELS } from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AllIssues() {
  const [issues, setIssues] = useState([]);
  const [filter, setFilter] = useState({ status: "all", category: "all", q: "" });

  useEffect(() => {
    api.get("/issues").then((r) => setIssues(r.data)).catch(() => {});
  }, []);

  const filtered = issues.filter((i) => {
    if (filter.status !== "all" && i.status !== filter.status) return false;
    if (filter.category !== "all" && i.category !== filter.category) return false;
    if (filter.q && !(`${i.title} ${i.address}`.toLowerCase().includes(filter.q.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="uppercase-label text-cyan-400 mb-2">ALL ISSUES</div>
        <h1 className="font-heading font-bold text-4xl tracking-tighter">City-wide issue queue</h1>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input data-testid="filter-search-input" placeholder="Search title / address" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} className="max-w-xs h-10 bg-white/5 border-white/10" />
        <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v })}>
          <SelectTrigger data-testid="filter-status-select" className="w-[180px] h-10 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filter.category} onValueChange={(v) => setFilter({ ...filter, category: v })}>
          <SelectTrigger data-testid="filter-category-select" className="w-[200px] h-10 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-xs text-slate-400 self-center font-mono-data">{filtered.length} of {issues.length}</div>
      </div>

      <div className="space-y-3" data-testid="all-issues-table">
        {filtered.map((it) => (
          <Link key={it.id} to={`/app/issues/${it.id}`} className="glass rounded-xl p-4 flex items-center gap-4 hover:-translate-y-0.5 transition-transform">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <StatusBadge status={it.status} />
                <PriorityBadge priority={it.priority} />
                {it.overdue && <span className="uppercase-label text-red-400">⚠ {it.hours_open}h</span>}
              </div>
              <div className="font-heading font-semibold truncate">{it.title}</div>
              <div className="text-xs text-slate-400 truncate">{it.address} · Reporter: {it.reporter_name} · Assigned: {it.assigned_official_name || "—"}</div>
            </div>
            <div className="text-right uppercase-label text-cyan-400 hidden md:block">{CATEGORY_LABELS[it.category]}</div>
          </Link>
        ))}
        {filtered.length === 0 && <div className="glass rounded-xl p-10 text-center text-slate-400">No issues match these filters.</div>}
      </div>
    </div>
  );
}
