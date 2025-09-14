import React from "react";

type State = "idle" | "active" | "complete" | "error" | "warning";

export default function StatusPill({ label, state = "idle", pulse = false, className = "" }: { label: string; state?: State; pulse?: boolean; className?: string }) {
  const color = state === "complete" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : state === "active" ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
    : state === "error" ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
    : state === "warning" ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
    : "bg-white/10 text-gray-200 border-white/20";
  return (
    <span className={`chip border ${color} ${pulse ? "animate-pulse" : ""} ${className}`} aria-live="polite">{label}</span>
  );
}


