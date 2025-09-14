import React from "react";
import StatusPill from "@/components/ui/StatusPill";
import ProgressBar from "@/components/ui/ProgressBar";

export type Stage = { 
  id: "chunking" | "detection" | "synthesis"; 
  label: string; 
  done: number; 
  total: number; 
  state: "idle" | "active" | "complete" | "error"; 
};

export default function Swimlane({ stages }: { stages: Stage[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stages.map((stage) => {
        const percent = stage.total > 0 ? (stage.done / stage.total) * 100 : 0;
        return (
          <div key={stage.id} className="glass rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-white">{stage.label}</h4>
              <StatusPill label={stage.state} state={stage.state} pulse={stage.state === "active"} />
            </div>
            <div className="text-xs text-gray-400 mb-2">
              {stage.done} / {stage.total}
            </div>
            <ProgressBar percent={percent} ariaLabel={`${stage.label}: ${Math.round(percent)}% complete`} />
          </div>
        );
      })}
    </div>
  );
}
