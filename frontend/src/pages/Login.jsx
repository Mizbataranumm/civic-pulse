import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome back, ${u.full_name}`);
      nav("/app");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const demoAs = (em) => { setEmail(em); setPassword("password123"); };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2.5 mb-10" data-testid="login-logo">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #06b6d4, #10b981)" }}>
              <Activity className="w-4 h-4 text-black" strokeWidth={2.8} />
            </div>
            <div>
              <div className="font-heading font-bold text-lg">CivicPulse</div>
              <div className="uppercase-label text-slate-500 -mt-0.5">Smart Governance</div>
            </div>
          </Link>

          <h1 className="font-heading font-bold text-4xl tracking-tight">Welcome back</h1>
          <p className="text-slate-400 mt-2">Sign in to track and resolve civic issues.</p>

          <form onSubmit={submit} className="mt-8 space-y-5" data-testid="login-form">
            <div>
              <Label className="uppercase-label text-slate-400">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                className="mt-2 h-11 bg-white/5 border-white/10 focus:border-cyan-400 focus:ring-cyan-400"
                placeholder="you@city.in"
              />
            </div>
            <div>
              <Label className="uppercase-label text-slate-400">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
                className="mt-2 h-11 bg-white/5 border-white/10 focus:border-cyan-400 focus:ring-cyan-400"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" disabled={loading} data-testid="login-submit-button" className="w-full h-11 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold">
              {loading ? "Signing in…" : <>Sign In <ArrowRight className="w-4 h-4 ml-1.5" /></>}
            </Button>
          </form>

          <div className="mt-6 p-4 rounded-lg glass border-white/10">
            <div className="uppercase-label text-emerald-400 mb-2">Demo Accounts</div>
            <div className="space-y-1.5 text-xs">
              <button data-testid="demo-citizen-button" onClick={() => demoAs("aarav@civicpulse.in")} className="block text-slate-300 hover:text-cyan-300 font-mono-data">citizen: aarav@civicpulse.in</button>
              <button data-testid="demo-official-button" onClick={() => demoAs("ramesh.official@civicpulse.in")} className="block text-slate-300 hover:text-cyan-300 font-mono-data">official: ramesh.official@civicpulse.in</button>
              <button data-testid="demo-supervisor-button" onClick={() => demoAs("anjali.supervisor@civicpulse.in")} className="block text-slate-300 hover:text-cyan-300 font-mono-data">supervisor: anjali.supervisor@civicpulse.in</button>
              <div className="text-slate-500 font-mono-data mt-2">password: password123</div>
            </div>
          </div>

          <p className="mt-6 text-sm text-slate-400">
            Don't have an account?{" "}
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 font-medium" data-testid="login-signup-link">Create one</Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:block flex-1 relative">
        <div className="absolute inset-0 grid-bg opacity-30"></div>
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at center, rgba(6,182,212,0.15), transparent 60%)" }}></div>
        <div className="relative h-full flex items-center justify-center p-12">
          <blockquote className="max-w-md">
            <div className="font-heading font-bold text-3xl leading-snug tracking-tight">"Real accountability is when the city responds before you have to ask twice."</div>
            <div className="mt-5 uppercase-label text-cyan-400">CivicPulse Manifesto</div>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
