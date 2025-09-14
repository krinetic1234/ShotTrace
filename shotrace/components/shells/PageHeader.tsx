import React from "react";

export default function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between mb-12">
      <div className="space-y-3">
        <h1 className="text-5xl font-bold text-white tracking-tight leading-tight bg-gradient-to-r from-white via-white to-gray-300 bg-clip-text text-transparent">{title}</h1>
        {subtitle && <p className="text-xl text-gray-300 font-medium leading-relaxed max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-4">{actions}</div>}
    </header>
  );
}
