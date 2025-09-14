"use client";

import React, { useEffect } from "react";

export default function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl rounded-2xl bg-black/70 border border-white/15 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="text-sm font-medium text-white/90">{title}</div>
            <button aria-label="Close" onClick={onClose} className="text-white/70 hover:text-white px-2 py-1 rounded-md hover:bg-white/10">✕</button>
          </div>
          <div className="p-4 max-h-[70vh] overflow-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}


