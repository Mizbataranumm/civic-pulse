import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, CATEGORY_LABELS } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import MapView from "@/components/MapView";
import { ArrowLeft, MessageSquare, Send, ThumbsUp, AlertTriangle } from "lucide-react";

export default function IssueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [comment, setComment] = useState("");
  const [officials, setOfficials] = useState([]);

  const load = async () => {
    try {
      const { data } = await api.get(`/issues/${id}`);
      setData(data);
    } catch (e) { /* noop */ }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (user && (user.role === "supervisor" || user.role === "official")) {
      api.get("/officials").then((r) => setOfficials(r.data)).catch(() => {});
    }
  }, [user]);

  if (!data) return <div className="text-slate-400 p-6">Loading…</div>;
  const { issue, comments, activity } = data;
  const canUpdate = user?.role === "official" || user?.role === "supervisor";

  const updateStatus = async (status) => {
    try {
      await api.patch(`/issues/${id}`, { status });
      toast.success(`Status → ${status}`);
      load();
    } catch (e) { toast.error("Update failed"); }
  };

  const assign = async (off_id) => {
    try {
      await api.patch(`/issues/${id}`, { assigned_official_id: off_id });
      toast.success("Assigned");
      load();
    } catch (e) { toast.error("Assign failed"); }
  };

  const send = async () => {
    if (!comment.trim()) return;
    try {
      await api.post(`/issues/${id}/comments`, { comment });
      setComment("");
      load();
    } catch (e) { toast.error("Comment failed"); }
  };

  const upvote = async () => {
    try {
      await api.post(`/issues/${id}/upvote`);
      load();
    } catch (e) { /* noop */ }
  };

  return (
    <div className="space-y-6">
      <Link to="/app" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-300" data-testid="issue-back-link">
        <ArrowLeft className="w-4 h-4"/> Back
      </Link>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          {issue.overdue && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30 uppercase-label">
              <AlertTriangle className="w-3 h-3" /> Overdue · {issue.hours_open}h
            </span>
          )}
        </div>
        <h1 className="font-heading font-bold text-3xl md:text-4xl tracking-tight">{issue.title}</h1>
        <div className="mt-2 uppercase-label text-cyan-400">{CATEGORY_LABELS[issue.category]} · {issue.address}</div>

        <div className="grid lg:grid-cols-12 gap-6 mt-6">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-slate-300 leading-relaxed">{issue.description}</p>
            {issue.ai_summary && issue.ai_summary !== issue.description && (
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-sm text-slate-300">
                <span className="uppercase-label text-emerald-400">AI Summary · </span>{issue.ai_summary}
              </div>
            )}
            {issue.image_url && <img alt="evidence" src={issue.image_url} className="rounded-lg border border-white/10 max-h-80" data-testid="issue-image" />}

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="glass rounded-lg p-3">
                <div className="uppercase-label text-slate-500">Reporter</div>
                <div className="font-medium mt-1">{issue.reporter_name}</div>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="uppercase-label text-slate-500">Assigned</div>
                <div className="font-medium mt-1">{issue.assigned_official_name || "—"}</div>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="uppercase-label text-slate-500">Upvotes</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono-data font-semibold">{issue.upvotes}</span>
                  <button onClick={upvote} data-testid="issue-upvote-button" className="text-cyan-400 hover:text-cyan-300">
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-5">
            <MapView issues={[issue]} center={[issue.latitude, issue.longitude]} zoom={14} height="280px" fit={false} />
          </div>
        </div>
      </div>

      {canUpdate && (
        <div className="glass rounded-2xl p-6" data-testid="issue-update-panel">
          <div className="uppercase-label text-cyan-400 mb-3">OFFICIAL CONTROLS</div>
          <div className="flex flex-wrap gap-2">
            {["acknowledged","in_progress","resolved","closed"].map((s) => (
              <Button key={s} variant="outline" data-testid={`status-${s}-button`} onClick={() => updateStatus(s)}
                className="border-white/15 hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/40 text-xs">
                Mark as {s.replace("_"," ")}
              </Button>
            ))}
            {user?.role === "supervisor" && officials.length > 0 && (
              <Select onValueChange={assign}>
                <SelectTrigger data-testid="assign-official-select" className="w-[220px] h-9 bg-white/5 border-white/15 text-xs">
                  <SelectValue placeholder="Assign to official…" />
                </SelectTrigger>
                <SelectContent>
                  {officials.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name} · {o.ward}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass rounded-2xl p-6" data-testid="issue-comments">
          <h3 className="font-heading font-bold text-xl mb-4 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-cyan-400"/> Discussion</h3>
          <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono-data flex-shrink-0"
                     style={{ background: c.user_role === 'official' ? '#06b6d4' : c.user_role === 'supervisor' ? '#10b981' : '#475569', color:'#000' }}>
                  {c.user_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate-400">
                    <span className="font-medium text-slate-200">{c.user_name}</span>
                    <span className="uppercase-label ml-2 text-cyan-400">{c.user_role}</span>
                  </div>
                  <div className="text-sm text-slate-300 mt-0.5">{c.comment}</div>
                </div>
              </div>
            ))}
            {comments.length === 0 && <div className="text-slate-500 text-sm">No comments yet — be the first.</div>}
          </div>
          <div className="flex gap-2">
            <Textarea data-testid="comment-input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" className="bg-white/5 border-white/10 focus:border-cyan-400" rows={2} />
            <Button onClick={send} data-testid="comment-send-button" className="bg-cyan-500 hover:bg-cyan-400 text-black h-auto"><Send className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="lg:col-span-5 glass rounded-2xl p-6" data-testid="issue-activity">
          <h3 className="font-heading font-bold text-xl mb-4">Activity Timeline</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {activity.map((a) => (
              <div key={a.id} className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="text-sm text-slate-200">{a.action}</div>
                  <div className="text-[10px] uppercase-label text-slate-500 mt-0.5 font-mono-data">{new Date(a.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
