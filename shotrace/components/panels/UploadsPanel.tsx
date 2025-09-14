import React from "react";
import Collapsible from "@/components/ui/Collapsible";

export default function UploadsPanel({ job, processed, raw }: { job: string; processed: string[]; raw: string[] }) {
  return (
    <Collapsible title={`Uploads — ${job}`} defaultOpen>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
        <div>
          <div className="text-gray-400 mb-2 font-medium">Processed</div>
          <div className="flex flex-wrap gap-2">
            {processed.map((f) => (
              <span key={f} className="chip">{f}</span>
            ))}
            {!processed.length && <span className="text-gray-500">No processed videos</span>}
          </div>
        </div>
        <div>
          <div className="text-gray-400 mb-2 font-medium">Raw</div>
          <div className="flex flex-wrap gap-2">
            {raw.map((f) => (
              <span key={f} className="chip">{f}</span>
            ))}
            {!raw.length && <span className="text-gray-500">No raw videos</span>}
          </div>
        </div>
      </div>
    </Collapsible>
  );
}
