import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, CATEGORY_LABELS } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MapView from "@/components/MapView";
import { toast } from "sonner";
import { Sparkles, Upload, MapPin, Loader2 } from "lucide-react";

export default function ReportIssue() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "pothole",
    priority: "medium",
    latitude: 12.9716,
    longitude: 77.5946,
    address: "",
    image_url: null,
  });
  const [picked, setPicked] = useState([12.9716, 77.5946]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setLoc = useCallback((lat, lng) => {
    setPicked([lat, lng]);
    setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation unavailable in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc(pos.coords.latitude, pos.coords.longitude);
        toast.success("Location detected");
      },
      () => toast.error("Could not get location")
    );
  };

  const runAI = async () => {
    if (form.description.trim().length < 10) {
      toast.error("Add a bit more description first");
      return;
    }
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/categorize", { description: form.description });
      setAiResult(data);
      setForm((f) => ({
        ...f,
        category: data.category || f.category,
        priority: data.priority || f.priority,
      }));
      toast.success("AI categorized your report");
    } catch (e) {
      toast.error("AI categorization failed");
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-run AI after 1.5s of inactivity in description
  useEffect(() => {
    if (form.description.trim().length < 15) return;
    const t = setTimeout(() => { if (!aiLoading) runAI(); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [form.description]);

  const onImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, image_url: reader.result }));
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.address.trim()) { toast.error("Add the address"); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post("/issues", form);
      toast.success("Issue reported! Tracking ID: " + data.id.slice(0, 8));
      nav(`/app/issues/${data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to submit");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="uppercase-label text-cyan-400 mb-2">REPORT AN ISSUE</div>
        <h1 className="font-heading font-bold text-4xl md:text-5xl tracking-tighter">Make it impossible to ignore.</h1>
        <p className="text-slate-400 mt-2">Describe the problem — our AI will auto-categorize and prioritize.</p>
      </div>

      <form onSubmit={submit} className="grid lg:grid-cols-12 gap-6" data-testid="report-form">
        <div className="lg:col-span-7 space-y-5 glass rounded-2xl p-6">
          <div>
            <Label className="uppercase-label text-slate-400">Title</Label>
            <Input
              data-testid="report-title-input"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-2 h-11 bg-white/5 border-white/10 focus:border-cyan-400"
              placeholder="E.g. Massive pothole on MG Road causing accidents"
            />
          </div>
          <div>
            <Label className="uppercase-label text-slate-400 flex items-center justify-between">
              Description
              {aiLoading && <span className="text-emerald-400 flex items-center gap-1 normal-case tracking-normal text-[10px]"><Loader2 className="w-3 h-3 animate-spin"/> AI analyzing…</span>}
            </Label>
            <Textarea
              data-testid="report-description-input"
              required
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-2 bg-white/5 border-white/10 focus:border-cyan-400"
              placeholder="Describe what you see, when it started, why it matters…"
            />
            {aiResult && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20" data-testid="ai-result-panel">
                <div className="flex items-center gap-2 uppercase-label text-emerald-400 mb-2">
                  <Sparkles className="w-3 h-3"/> AI Analysis
                </div>
                <div className="text-sm text-slate-300">{aiResult.ai_summary}</div>
                <div className="text-xs text-slate-500 mt-2 font-mono-data">
                  ROUTE → {aiResult.suggested_department}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="uppercase-label text-slate-400">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="report-category-select" className="mt-2 h-11 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="uppercase-label text-slate-400">Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger data-testid="report-priority-select" className="mt-2 h-11 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="uppercase-label text-slate-400">Address</Label>
            <Input
              data-testid="report-address-input"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-2 h-11 bg-white/5 border-white/10 focus:border-cyan-400"
              placeholder="Street, locality, city"
            />
          </div>

          <div>
            <Label className="uppercase-label text-slate-400">Photo (optional)</Label>
            <label className="mt-2 flex items-center gap-3 p-4 rounded-lg border border-dashed border-white/15 bg-white/5 cursor-pointer hover:border-cyan-400/40" data-testid="report-image-upload-label">
              <Upload className="w-5 h-5 text-cyan-400" />
              <span className="text-sm text-slate-400">{form.image_url ? "Image attached — click to replace" : "Click to upload an image (max 2MB)"}</span>
              <input type="file" accept="image/*" onChange={onImage} className="hidden" data-testid="report-image-input" />
            </label>
            {form.image_url && (
              <img alt="preview" src={form.image_url} className="mt-3 rounded-lg max-h-48 border border-white/10" data-testid="report-image-preview" />
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <Label className="uppercase-label text-slate-400">Pin Location on Map</Label>
              <Button type="button" variant="outline" size="sm" onClick={useMyLocation} data-testid="use-my-location-button" className="border-white/15 hover:bg-cyan-500/10 hover:text-cyan-300 text-xs h-8">
                <MapPin className="w-3.5 h-3.5 mr-1" /> Use my location
              </Button>
            </div>
            <MapView issues={[]} center={picked} zoom={13} height="280px" onPickLocation={setLoc} pickedPin={picked} fit={false} />
            <div className="mt-2 text-xs font-mono-data text-slate-500">
              {picked[0].toFixed(5)}, {picked[1].toFixed(5)}
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            data-testid="report-submit-button"
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-base"
          >
            {submitting ? "Submitting…" : "Submit Report"}
          </Button>
        </div>
      </form>
    </div>
  );
}
