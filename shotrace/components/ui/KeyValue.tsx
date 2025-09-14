import React from "react";

export default function KeyValue({ items }: { items: Array<{ key: React.ReactNode; value: React.ReactNode }> }) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm">
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="text-gray-400">{it.key}</dt>
          <dd className="text-white text-right">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}


