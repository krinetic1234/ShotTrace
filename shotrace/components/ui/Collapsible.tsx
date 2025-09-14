"use client";

import React, { useId, useState } from "react";

export default function Collapsible({ title, defaultOpen = false, children }: { title: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const id = useId();
  return (
    <section className="rounded-xl glow-card">
      <div className="flex items-center justify-between p-6">
        <h3 className="text-white font-medium" id={id}>{title}</h3>
        <button
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen(o => !o)}
          className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <span className="text-xs text-white transform transition-transform duration-200" style={{transform: open ? 'rotate(180deg)' : 'rotate(0deg)'}}>▼</span>
        </button>
      </div>
      {open && (
        <div id={`${id}-panel`} className="px-6 pb-6 pt-0 animate-slide-in">{children}</div>
      )}
    </section>
  );
}


