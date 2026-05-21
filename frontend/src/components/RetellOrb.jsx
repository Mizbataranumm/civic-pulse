import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Mic } from "lucide-react";

const RETELL_URL = "https://agent.retellai.com/orb/agent_10f1a66c8a90ed960ec28d902b?token=237de10b73f96d76964473b18ebbca6e";

export default function RetellOrb() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating orb button */}
      <motion.button
        data-testid="retell-orb-button"
        onClick={() => setOpen(true)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.2, type: "spring" }}
        whileHover={{ scale: 1.08 }}
        className="fixed bottom-6 right-24 z-[60] w-16 h-16 rounded-full flex items-center justify-center cursor-pointer"
        style={{
          background: "radial-gradient(circle at 30% 30%, #34d399, #06b6d4 60%, #0e7490)",
          boxShadow: "0 0 40px rgba(6, 182, 212, 0.55), 0 0 80px rgba(16, 185, 129, 0.35), inset 0 -8px 20px rgba(0,0,0,0.4)",
        }}
      >
        <span className="absolute inset-0 rounded-full pulse-ring" style={{ boxShadow: "0 0 0 4px rgba(6, 182, 212, 0.25)" }}></span>
        <Mic className="w-7 h-7 text-white relative z-10" strokeWidth={2.4} />
      </motion.button>

      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0 }}
          data-testid="retell-orb-modal"
          className="fixed bottom-24 right-24 z-[70] w-[360px] h-[520px] rounded-2xl overflow-hidden glass-strong glow-cyan"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div>
              <div className="font-heading text-sm font-semibold">Nova — Voice Reporter</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono-data">Powered by Retell AI</div>
            </div>
            <button
              data-testid="retell-orb-close"
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <iframe
            src={RETELL_URL}
            title="Retell Voice Orb"
            className="w-full h-[calc(100%-56px)] bg-black"
            allow="microphone; autoplay"
          />
        </motion.div>
      )}
    </>
  );
}
