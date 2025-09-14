import React from "react";
import StatusPill from "@/components/ui/StatusPill";

export default function SummaryArtifacts({
  summaryReady,
  responderCard,
  operationsPlan,
  onOpenResponder,
  onOpenOpsPlan,
}: {
  summaryReady: boolean;
  responderCard?: any;
  operationsPlan?: any;
  onOpenResponder?: () => void;
  onOpenOpsPlan?: () => void;
}) {
  return (
    <div className="glass rounded-lg p-6 border border-white/10">
      <div className="text-sm font-medium text-white mb-3">Summary Artifacts</div>
      <div className="flex flex-wrap gap-2">
        <StatusPill 
          label="Video Summary" 
          state={summaryReady ? "complete" : "idle"} 
        />
        {responderCard && (
          <button 
            onClick={onOpenResponder}
            className="chip hover:bg-white/20 transition-colors"
          >
            Responder Card ↗
          </button>
        )}
        {operationsPlan && (
          <button 
            onClick={onOpenOpsPlan}
            className="chip hover:bg-white/20 transition-colors"
          >
            Operations Plan ↗
          </button>
        )}
      </div>
    </div>
  );
}
