import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, CATEGORY_LABELS } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import MapView from "@/components/MapView";
import { ArrowLeft, MessageSquare, Send, ThumbsUp, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";

export default function IssueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [comment, setComment] = useState("");
  const [officials, setOfficials] = useState([]);
  const [voted, setVoted] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [resolveForm, setResolveForm] = useState({ resolution_note: "", resolution_image: null });
  const [reassignForm, setReassignForm] = useState({ new_official_id: "", reason: "" });

  // ✅ Fixed: onResolveImage
  const onResolveImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setResolveForm(f => ({ ...f, resolution_image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // ✅ Fixed: submitResolution
  const submitResolution = async () => {
    if (!resolveForm.resolution_note || resolveForm.resolution_note.length < 10) {
      toast.error("Resolution note must be at least 10 characters");
      return;
    }
    try {
      await api.patch(`/issues/${id}`, {
        status: "resolved",
        resolution_note: resolveForm.resolution_note,
        resolution_image: resolveForm.resolution_image || null,
      });
      toast.success("Issue marked as resolved!");
      setResolveOpen(false);
      load();
    } catch (err) {
      toast.error("Failed to resolve issue");
    }
  };

  // ✅ Fixed: submitReassign
  const submitReassign = async () => {
    if (!reassignForm.new_official_id) {
      toast.error("Please select an official");
      return;
    }
    try {
      await api.post(`/issues/${id}/reassign`, {
        new_official_id: reassignForm.new_official_id,
        reason: reassignForm.reason,
      });
      toast.success("Issue reassigned!");
      setReassignOpen(false);
      load();
    } catch (err) {
      toast.error("Failed to reassign issue");
    }
  };

  const load = async () => {
    try {
      const { data } = await api.get(`/issues/${id}`);
      setData(data);
    } catch (e) {
      console.error("Failed to load issue", e);
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    api.get(`/issues/${id}/has-voted`).then((r) => setVoted(r.data.voted)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (user && (user.role === "supervisor" || user.role === "official")) {
      api.get("/officials")
        .then((r) => setOfficials(r.data))
        .catch((e) => console.error("Failed to load officials", e));
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
      const { data: r } = await api.post(`/issues/${id}/upvote`);
      setVoted(r.voted);
      load();
    } catch (e) {
      console.error("Upvote failed", e);
    }
  };

  const roleColor = (role) => {
    if (role === "official") return "#06b6d4";
    if (role === "supervisor") return "#10b981";
    return "#475569";
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
        {issue.assigned_department && (
          <div className="mt-2 inline-flex items-center gap-2 text-xs text-slate-400">
            <span className="uppercase-label text-emerald-400">ROUTED TO ·</span>
            <span className="font-mono-data">{issue.assigned_department}</span>
            {issue.assigned_official_name && <span className="text-slate-500">— {issue.assigned_official_name}</span>}
          </div>
        )}
        {issue.resolution_verification && (
          <div className={`mt-3 p-3 rounded-lg border text-sm flex items-start gap-3 ${issue.resolution_verification.suspicious ? "bg-red-500/10 border-red-500/30" : "bg-emerald-500/5 border-emerald-500/20"}`} data-testid="ai-verification-panel">
            {issue.resolution_verification.suspicious
              ? <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              : <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />}
            <div>
              <div className="uppercase-label" style={{ color: issue.resolution_verification.suspicious ? "#f87171" : "#34d399" }}>
                AI VERIFICATION · confidence {issue.resolution_verification.confidence}
              </div>
              <div className="text-slate-300 mt-1">{issue.resolution_verification.reasoning}</div>
              {issue.resolution_note && <div className="text-xs text-slate-500 mt-1 font-mono-data">Note: "{issue.resolution_note}"</div>}
            </div>
          </div>
        )}

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
                  <button onClick={upvote} data-testid="issue-upvote-button" className={voted ? "text-emerald-400" : "text-cyan-400 hover:text-cyan-300"} title={voted ? "Click to remove your vote" : "Upvote"}>
                    <ThumbsUp className="w-3.5 h-3.5" fill={voted ? "currentColor" : "none"} />
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
              <Button key={s} variant="outline" data-testid={`status-${s}-button`}
                onClick={() => s === "resolved" ? setResolveOpen(true) : updateStatus(s)}
                className="border-white/15 hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/40 text-xs">
                Mark as {s.replace("_"," ")}
              </Button>
            ))}
            {user?.role === "supervisor" && officials.length > 0 && (
              <Button onClick={() => setReassignOpen(true)} variant="outline" data-testid="reassign-open-button" className="border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-500/50 text-xs">
                Reassign Official
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="bg-[#0a0a0c] border-white/10" data-testid="resolve-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">Mark as Resolved</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-400">AI will verify your resolution note against the original complaint.</p>
          <div className="space-y-3">
            <div>
              <Label className="uppercase-label text-slate-400">Resolution Note (min 10 chars)</Label>
              <Textarea data-testid="resolve-note-input" rows={3} value={resolveForm.resolution_note}
                onChange={(e) => setResolveForm({ ...resolveForm, resolution_note: e.target.value })}
                placeholder="Describe the action taken..."
                className="mt-2 bg-white/5 border-white/10 focus:border-emerald-400" />
            </div>
            <div>
              <Label className="uppercase-label text-slate-400">Resolution Photo (recommended)</Label>
              <input type="file" accept="image/*" onChange={onResolveImage} data-testid="resolve-image-input" className="mt-2 block text-sm text-slate-400" />
              {resolveForm.resolution_image && <img alt="proof" src={resolveForm.resolution_image} className="mt-2 rounded-lg max-h-40 border border-white/10" />}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)} className="border-white/15">Cancel</Button>
            <Button onClick={submitResolution} data-testid="resolve-submit-button" className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">Submit & Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="bg-[#0a0a0c] border-white/10" data-testid="reassign-dialog">
          <DialogHeader><DialogTitle className="font-heading text-2xl">Reassign to Different Official</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="uppercase-label text-slate-400">New Official</Label>
              <Select value={reassignForm.new_official_id} onValueChange={(v) => setReassignForm({ ...reassignForm, new_official_id: v })}>
                <SelectTrigger data-testid="reassign-official-select" className="mt-2 bg-white/5 border-white/10">
                  <SelectValue placeholder="Pick official…" />
                </SelectTrigger>
                <SelectContent>
                  {officials.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name} · load {o.active_load}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="uppercase-label text-slate-400">Reason</Label>
              <Input data-testid="reassign-reason-input" value={reassignForm.reason}
                onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })}
                className="mt-2 bg-white/5 border-white/10" placeholder="Reason for reassignment" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)} className="border-white/15">Cancel</Button>
            <Button onClick={submitReassign} data-testid="reassign-submit-button" className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">Reassign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass rounded-2xl p-6" data-testid="issue-comments">
          <h3 className="font-heading font-bold text-xl mb-4 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-cyan-400"/> Discussion</h3>
          <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono-data flex-shrink-0"
                     style={{ background: roleColor(c.user_role), color:'#000' }}>
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
            {comments.length === 0 && <div className="text-slate-500 text-sm">No comments yet.</div>}
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