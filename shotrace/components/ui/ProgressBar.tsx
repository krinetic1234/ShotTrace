import React from "react";

export default function ProgressBar({ percent, ariaLabel }: { percent: number; ariaLabel?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="w-full h-2 bg-white/10 rounded" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} aria-label={ariaLabel}>
      <div className="h-2 rounded" style={{ width: `${clamped}%`, background: 'var(--primary)' }} />
    </div>
  );
}


