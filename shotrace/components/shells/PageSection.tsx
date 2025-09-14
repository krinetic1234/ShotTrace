import React from "react";

export default function PageSection({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mb-8 ${className}`}>
      {title && <h2 className="text-2xl font-semibold text-white mb-4">{title}</h2>}
      {children}
    </section>
  );
}
