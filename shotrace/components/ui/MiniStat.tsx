import React from "react";
import StatusPill from "./StatusPill";

export default function MiniStat({ label, value, pill }: { label: string; value: React.ReactNode; pill?: { label: string; state?: "idle"|"active"|"complete"|"error"|"warning" } }) {
  return (
    <div className="glass rounded-xl p-6 border border-white/10 space-y-3">
      <div className="text-sm text-gray-400 font-medium">{label}</div>
      <div className="flex items-center gap-3">
        <div className="text-2xl font-bold text-white">{value}</div>
        {pill && <StatusPill label={pill.label} state={pill.state} />}
      </div>
    </div>
  );
}


