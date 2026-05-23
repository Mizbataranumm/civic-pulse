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
import { Sparkles, Upload, MapPin, Loader2, Search } from "lucide-react";

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
  const [locatingAddress, setLocatingAddress] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState(null);

  const setLoc = useCallback((lat, lng) => {
    setPicked([lat, lng]);
    setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
  }, []);

  const buildEnglishAddress = useCallback((data) => {
    const addr = data.address || {};
    const parts = [
      addr.road || addr.pedestrian || addr.neighbourhood || addr.suburb || addr.quarter,
      addr.city || addr.town || addr.village || addr.municipality || addr.state_district,
      addr.state,
    ].filter(Boolean);

    const label = parts.join(", ") || data.display_name || "";
    return label.replace(/\s+/g, " ").trim();
  }, []);

  const syncAddressFromCoords = useCallback(async (lat, lng) => {
    setReverseGeocoding(true);
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(lat),
        lon: String(lng),
        zoom: "18",
        addressdetails: "1",
        "accept-language": "en",
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
        headers: { "Accept-Language": "en" },
      });
      if (!res.ok) throw new Error("reverse geocode failed");
      const data = await res.json();
      const label = buildEnglishAddress(data);

      if (label) {
        setForm((f) => ({ ...f, address: label }));
      }
    } catch (e) {
      console.error("Reverse geocoding failed", e);
    } finally {
      setReverseGeocoding(false);
    }
  }, [buildEnglishAddress]);

  const locateAddressOnMap = useCallback(async () => {
    const query = form.address.trim();
    if (query.length < 3) {
      toast.error("Enter a more specific address");
      return;
    }

    setLocatingAddress(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        limit: "1",
        countrycodes: "in",
        addressdetails: "1",
        "accept-language": "en",
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: { "Accept-Language": "en" },
      });
      if (!res.ok) throw new Error("address lookup failed");
      const data = await res.json();
      const best = data?.[0];

      if (!best) {
        toast.error("Could not find that address on the map");
        return;
      }

      const lat = Number(best.lat);
      const lng = Number(best.lon);
      setLoc(lat, lng);
      setLocationAccuracy(null);
      setForm((f) => ({ ...f, address: buildEnglishAddress(best) || f.address }));
      toast.success("Pinned address on the map");
    } catch (e) {
      console.error("Address lookup failed", e);
      toast.error("Could not locate that address right now");
    } finally {
      setLocatingAddress(false);
    }
  }, [buildEnglishAddress, form.address, setLoc]);

  const pickOnMap = useCallback((lat, lng) => {
    setLocationAccuracy(null);
    setLoc(lat, lng);
    syncAddressFromCoords(lat, lng);
  }, [setLoc, syncAddressFromCoords]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation unavailable in this browser");
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accuracy = Math.round(pos.coords.accuracy || 0);
        setLoc(pos.coords.latitude, pos.coords.longitude);
        setLocationAccuracy(accuracy || null);
        syncAddressFromCoords(pos.coords.latitude, pos.coords.longitude);
        if (accuracy && accuracy > 100) {
          toast.warning(`Location detected, but accuracy is about ${accuracy}m. Move the pin if needed.`);
        } else {
          toast.success(accuracy ? `Location detected within about ${accuracy}m` : "Location detected");
        }
        setLocatingUser(false);
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        toast.error(denied ? "Allow location access in the browser and try again" : "Could not get a precise location");
        setLocatingUser(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const runAI = useCallback(async (description, signal) => {
    if (description.trim().length < 10) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/categorize", { description }, { signal });
      setAiResult(data);

      const VALID_CATEGORIES = ['pothole','garbage','water_leakage','streetlight','drainage','sewage','illegal_construction','fallen_tree','other'];
      const VALID_PRIORITIES = ['low','medium','high','critical'];

      const safeCategory = VALID_CATEGORIES.includes(data.category) ? data.category : null;
      const safePriority = VALID_PRIORITIES.includes(data.priority) ? data.priority : null;

      setForm((f) => ({
        ...f,
        category: safeCategory || f.category,
        priority: safePriority || f.priority,
      }));

      if (safeCategory && safePriority) {
        toast.success("AI categorized your report");
      } else {
        toast.warning("AI ran but returned an unexpected value — please check category/priority");
      }
    } catch (e) {
      if (e.name === "CanceledError" || e.code === "ERR_CANCELED") return;
      console.error("AI categorization failed", e);
    } finally {
      setAiLoading(false);
    }
  }, []);

  // Auto-run AI after 1.5s of inactivity, ONCE — request cancellation on retype
  useEffect(() => {
    const description = form.description;
    if (description.trim().length < 15) return;
    const controller = new AbortController();
    const t = setTimeout(() => { runAI(description, controller.signal); }, 1500);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [form.description, runAI]);

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
            <div className="flex items-center justify-between gap-3">
              <Label className="uppercase-label text-slate-400">Address</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={locateAddressOnMap}
                disabled={locatingAddress}
                className="h-7 px-2 text-[11px] text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10"
              >
                {locatingAddress ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Search className="w-3 h-3 mr-1" />}
                Locate on map
              </Button>
            </div>
            <Input
              data-testid="report-address-input"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-2 h-11 bg-white/5 border-white/10 focus:border-cyan-400"
              placeholder="Street, locality, city"
            />
            <div className="mt-2 text-[11px] text-slate-500">
              Type an address and press `Locate on map`, or click directly on the map to drop an exact pin.
            </div>
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
              <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locatingUser} data-testid="use-my-location-button" className="border-white/15 hover:bg-cyan-500/10 hover:text-cyan-300 text-xs h-8">
                {locatingUser ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <MapPin className="w-3.5 h-3.5 mr-1" />}
                {locatingUser ? "Locating..." : "Use my location"}
              </Button>
            </div>
            <MapView
              issues={[]}
              center={picked}
              zoom={17}
              height="280px"
              onPickLocation={pickOnMap}
              pickedPin={picked}
              pickedPinLabel={form.address}
              accuracyRadius={locationAccuracy}
              fit={false}
            />
            <div className="mt-2 text-xs font-mono-data text-slate-500">
              {picked[0].toFixed(5)}, {picked[1].toFixed(5)}
              {locationAccuracy && <span className="ml-2 text-cyan-400">accuracy ~{locationAccuracy}m</span>}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {reverseGeocoding ? "Updating address from selected pin..." : "Click the exact road spot to place the report pin."}
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
