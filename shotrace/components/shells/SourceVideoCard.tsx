import React from "react";

export default function SourceVideoCard({
  title,
  badges,
  children,
}: {
  title: string;
  badges?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl bg-white/5 ring-1 ring-white/10 shadow-sm p-5 md:p-6 lg:p-7 leading-[1.35]"
    >
      <div className="flex items-start justify-between gap-3 pb-3 md:pb-4 border-b border-white/10">
        <h3 className="text-base md:text-lg font-semibold tracking-tight truncate" title={title}>
          {title}
        </h3>
        <div className="shrink-0 flex items-center gap-2">{badges}</div>
      </div>

      <div className="pt-4 md:pt-5 space-y-6 md:space-y-7">{children}</div>
    </section>
  );
}


