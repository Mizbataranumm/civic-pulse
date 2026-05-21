import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, ArrowRight, Mic, Bot, Sparkles, ShieldCheck, MapPin, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, CATEGORY_LABELS } from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";

const HERO_BG = "https://static.prod-images.emergentagent.com/jobs/f651b65c-d079-4fe2-aa77-aa015c70639a/images/9f3f85492b2cf0b2c2242cc2ad0c8c249035f7768cdb3cbd06fcf740a2d7a2df.png";
const DASH_PREVIEW = "https://static.prod-images.emergentagent.com/jobs/f651b65c-d079-4fe2-aa77-aa015c70639a/images/a30a79aad530e13c04cf748ad0ef3bec44b8a6514d9fae477365680df0b79ea4.png";

const StatCounter = ({ label, value, suffix = "", accent }) => (
  <div className="glass rounded-xl p-5 border-white/10">
    <div className="uppercase-label text-slate-400 mb-2">{label}</div>
    <div className="font-heading font-bold text-3xl md:text-4xl tabular-nums" style={{ color: accent }}>
      {value}<span className="text-base ml-1 opacity-60">{suffix}</span>
    </div>
  </div>
);

export default function Landing() {
  const [analytics, setAnalytics] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.get("/analytics/public").then((r) => setAnalytics(r.data)).catch(() => {});
    api.get("/issues/public").then((r) => setRecent(r.data.slice(0, 4))).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-30 glass-strong border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" data-testid="landing-logo">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #06b6d4, #10b981)" }}>
              <Activity className="w-4 h-4 text-black" strokeWidth={2.8} />
            </div>
            <div>
              <div className="font-heading font-bold text-base">CivicPulse</div>
              <div className="uppercase-label text-slate-500 -mt-0.5">Smart Governance</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm">
            <a href="#features" className="text-slate-300 hover:text-cyan-400 transition-colors">Features</a>
            <a href="#how" className="text-slate-300 hover:text-cyan-400 transition-colors">How It Works</a>
            <Link to="/transparency" className="text-slate-300 hover:text-cyan-400 transition-colors" data-testid="landing-transparency-link">Public Dashboard</Link>
            <Link to="/login" className="text-slate-300 hover:text-cyan-400 transition-colors" data-testid="landing-login-link">Login</Link>
          </nav>
          <Link to="/signup" data-testid="landing-cta-signup">
            <Button className="bg-cyan-500 text-black hover:bg-cyan-400 font-medium">
              Get Started <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32">
        <div className="absolute inset-0 -z-10 grid-bg opacity-50"></div>
        <div className="absolute inset-0 -z-10 opacity-30" style={{ backgroundImage: `url(${HERO_BG})`, backgroundSize: "cover", backgroundPosition: "center", filter: "saturate(0.8)" }}></div>
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(ellipse at top, transparent 20%, #09090b 70%)" }}></div>

        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-6" data-testid="landing-tagline-badge">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="uppercase-label text-slate-300">Real-time Civic Accountability • Built for Indian Cities</span>
            </div>
            <h1 className="font-heading font-bold text-5xl md:text-7xl lg:text-8xl leading-[1.02] tracking-tighter max-w-5xl">
              Your City.<br/>
              Your Voice.<br/>
              <span style={{ background: "linear-gradient(90deg, #06b6d4, #10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Real Accountability.
              </span>
            </h1>
            <p className="mt-7 text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed">
              CivicPulse transforms ignored civic complaints into <span className="text-emerald-400 font-medium">real-time accountable action</span>. AI-powered triage. Transparent SLAs. Empowered citizens.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Link to="/signup" data-testid="hero-cta-report">
                <Button size="lg" className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-7 h-12">
                  Report an Issue <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
              <Link to="/transparency" data-testid="hero-cta-transparency">
                <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-cyan-300 px-7 h-12">
                  <BarChart3 className="w-4 h-4 mr-1.5" /> See Live Transparency
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Live counters */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <StatCounter label="Total Reports" value={analytics?.total ?? "—"} accent="#06b6d4" />
            <StatCounter label="Resolved" value={analytics?.resolved ?? "—"} accent="#10b981" />
            <StatCounter label="In Progress" value={analytics?.in_progress ?? "—"} accent="#f59e0b" />
            <StatCounter label="Avg Response" value={analytics?.avg_resolution_hours ?? "—"} suffix="h" accent="#94a3b8" />
          </motion.div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-5">
            <div className="uppercase-label text-red-400 mb-4">THE PROBLEM</div>
            <h2 className="font-heading font-bold text-4xl md:text-5xl leading-tight">Complaints disappear.<br/>Cities suffer in silence.</h2>
          </div>
          <div className="md:col-span-7 space-y-5 text-slate-400 leading-relaxed">
            <p className="text-lg">Every day, citizens spot dangerous potholes, overflowing drains, broken streetlights — and report them into <span className="text-red-300">black holes of paperwork</span>.</p>
            <p>The complaint goes to one department. That department forwards it to another. The trail vanishes. The pothole stays. The accountability evaporates.</p>
            <p className="text-emerald-400 font-medium">CivicPulse makes that disappearance impossible.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="uppercase-label text-cyan-400 mb-3">CAPABILITIES</div>
          <h2 className="font-heading font-bold text-4xl md:text-5xl tracking-tight max-w-3xl">Built for citizens. Engineered for accountability.</h2>

          <div className="mt-14 grid md:grid-cols-12 gap-5">
            {/* Feature 1 (large) */}
            <div className="md:col-span-7 glass rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 opacity-20" style={{ width: 320, height: 240, backgroundImage: `url(${DASH_PREVIEW})`, backgroundSize: "cover" }}></div>
              <Bot className="w-7 h-7 text-emerald-400" />
              <h3 className="font-heading font-bold text-2xl mt-4">AI-Triaged Reports with Gemini</h3>
              <p className="text-slate-400 mt-3 max-w-md">Describe your issue in plain language. Our AI assigns the category, priority, and routing department in seconds — no dropdowns, no friction.</p>
            </div>
            {/* Feature 2 */}
            <div className="md:col-span-5 glass rounded-2xl p-8">
              <MapPin className="w-7 h-7 text-cyan-400" />
              <h3 className="font-heading font-bold text-2xl mt-4">Live City Map</h3>
              <p className="text-slate-400 mt-3">See every active issue in your city as it happens. Colored pins. Real-time pulse.</p>
            </div>
            {/* Feature 3 */}
            <div className="md:col-span-4 glass rounded-2xl p-8">
              <ShieldCheck className="w-7 h-7 text-amber-400" />
              <h3 className="font-heading font-bold text-2xl mt-4">SLA Enforcement</h3>
              <p className="text-slate-400 mt-3">48h → escalated. 72h → supervisor alert. 7d → public critical flag. Time is on your side.</p>
            </div>
            {/* Feature 4 */}
            <div className="md:col-span-4 glass rounded-2xl p-8">
              <BarChart3 className="w-7 h-7 text-emerald-400" />
              <h3 className="font-heading font-bold text-2xl mt-4">Public Transparency</h3>
              <p className="text-slate-400 mt-3">Every citizen can audit ward performance, resolution rates, and SLA breaches — no login needed.</p>
            </div>
            {/* Feature 5 */}
            <div className="md:col-span-4 glass rounded-2xl p-8">
              <Mic className="w-7 h-7 text-cyan-400" />
              <h3 className="font-heading font-bold text-2xl mt-4">Voice Reporting with Nova</h3>
              <p className="text-slate-400 mt-3">Tap the orb. Speak naturally. Our voice agent files the report for you.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent activity */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="uppercase-label text-emerald-400 mb-2">LIVE FEED</div>
              <h2 className="font-heading font-bold text-3xl md:text-4xl">Recent civic reports across India</h2>
            </div>
            <Link to="/transparency" className="text-sm text-cyan-400 hover:text-cyan-300" data-testid="landing-see-all-link">See all →</Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recent.map((it) => (
              <div key={it.id} className="glass rounded-xl p-5 hover:-translate-y-1 transition-transform">
                <div className="flex items-center justify-between mb-3">
                  <StatusBadge status={it.status} />
                  <PriorityBadge priority={it.priority} />
                </div>
                <div className="font-heading font-semibold text-base mb-1.5 line-clamp-2">{it.title}</div>
                <div className="text-xs text-slate-400 line-clamp-2 mb-3">{it.address}</div>
                <div className="uppercase-label text-cyan-400">{CATEGORY_LABELS[it.category]}</div>
              </div>
            ))}
            {recent.length === 0 && ["s1","s2","s3","s4"].map((k) => (
              <div key={k} className="glass rounded-xl p-5 h-40 animate-pulse"></div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20"></div>
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <h2 className="font-heading font-bold text-4xl md:text-6xl tracking-tighter">Make civic complaints<br/>
            <span style={{ background: "linear-gradient(90deg, #06b6d4, #10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>impossible to ignore.</span>
          </h2>
          <p className="text-slate-400 mt-6 text-lg max-w-2xl mx-auto">Join thousands of citizens turning frustration into measurable change.</p>
          <div className="mt-9 flex justify-center gap-3">
            <Link to="/signup" data-testid="footer-cta-signup">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-8 h-12">Get Started Free</Button>
            </Link>
            <Link to="/transparency" data-testid="footer-cta-explore">
              <Button size="lg" variant="outline" className="border-white/20 bg-transparent hover:bg-white/5 text-white hover:text-cyan-300 px-8 h-12">Explore Live Dashboard</Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs uppercase-label text-slate-500">
        © 2026 CivicPulse — Built for the smart city era
      </footer>
    </div>
  );
}
