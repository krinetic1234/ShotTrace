import React from "react";

export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] md:text-sm font-medium text-white/70 mb-2">{children}</div>;
}


