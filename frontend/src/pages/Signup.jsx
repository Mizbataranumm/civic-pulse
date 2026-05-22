import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_LABELS } from "@/lib/api";

const WARDS = ["Central", "North", "South", "East", "West"];
const ASSIGNABLE_CATS = Object.keys(CATEGORY_LABELS).filter((c) => c !== "other");

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "citizen", ward: "Central", phone_number: "", assigned_categories: [] });
  const [loading, setLoading] = useState(false);

  const toggleCat = (cat) => {
    setForm((f) => ({
      ...f,
      assigned_categories: f.assigned_categories.includes(cat)
        ? f.assigned_categories.filter((c) => c !== cat)
        : [...f.assigned_categories, cat],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.phone_number && !/^[+\-\d\s()]{7,20}$/.test(form.phone_number)) {
      toast.error("Phone number looks invalid"); return;
    }
    if (form.role === "official" && form.assigned_categories.length === 0) {
      toast.error("Officials must select at least one department"); return;
    }
    setLoading(true);
    try {
      const u = await signup(form);
      toast.success(`Welcome, ${u.full_name}!`);
      nav("/app");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Signup failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2.5 mb-10" data-testid="signup-logo">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #06b6d4, #10b981)" }}>
            <Activity className="w-4 h-4 text-black" strokeWidth={2.8} />
          </div>
          <div>
            <div className="font-heading font-bold text-lg">CivicPulse</div>
            <div className="uppercase-label text-slate-500 -mt-0.5">Smart Governance</div>
          </div>
        </Link>

        <h1 className="font-heading font-bold text-4xl tracking-tight">Join CivicPulse</h1>
        <p className="text-slate-400 mt-2">Help build a city that listens.</p>

        <form onSubmit={submit} className="mt-8 space-y-4" data-testid="signup-form">
          <div>
            <Label className="uppercase-label text-slate-400">Full Name</Label>
            <Input data-testid="signup-name-input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-2 h-11 bg-white/5 border-white/10 focus:border-cyan-400" />
          </div>
          <div>
            <Label className="uppercase-label text-slate-400">Email</Label>
            <Input data-testid="signup-email-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 h-11 bg-white/5 border-white/10 focus:border-cyan-400" />
          </div>
          <div>
            <Label className="uppercase-label text-slate-400">Password</Label>
            <Input data-testid="signup-password-input" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-2 h-11 bg-white/5 border-white/10 focus:border-cyan-400" />
          </div>
          <div>
            <Label className="uppercase-label text-slate-400">Phone Number (optional)</Label>
            <Input data-testid="signup-phone-input" type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} className="mt-2 h-11 bg-white/5 border-white/10 focus:border-cyan-400" placeholder="+91-9876543210" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="uppercase-label text-slate-400">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="signup-role-select" className="mt-2 h-11 bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="citizen">Citizen</SelectItem>
                  <SelectItem value="official">Official</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="uppercase-label text-slate-400">Ward</Label>
              <Select value={form.ward} onValueChange={(v) => setForm({ ...form, ward: v })}>
                <SelectTrigger data-testid="signup-ward-select" className="mt-2 h-11 bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WARDS.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.role === "official" && (
            <div data-testid="signup-categories-block">
              <Label className="uppercase-label text-slate-400">Department(s) — pick categories you handle</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                {ASSIGNABLE_CATS.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`signup-cat-${cat}`}>
                    <Checkbox
                      checked={form.assigned_categories.includes(cat)}
                      onCheckedChange={() => toggleCat(cat)}
                    />
                    <span className="text-slate-300">{CATEGORY_LABELS[cat]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <Button type="submit" disabled={loading} data-testid="signup-submit-button" className="w-full h-11 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold">
            {loading ? "Creating account…" : <>Create Account <ArrowRight className="w-4 h-4 ml-1.5" /></>}
          </Button>
        </form>
        <p className="mt-6 text-sm text-slate-400">Already a member?{" "}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium" data-testid="signup-login-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
