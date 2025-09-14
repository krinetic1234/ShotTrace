import React from "react";

export default function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glow-card rounded-2xl p-6 md:p-7 border border-white/20 backdrop-blur-sm transition-all duration-300 shadow-xl ${className}`}>
      {children}
    </div>
  );
}
