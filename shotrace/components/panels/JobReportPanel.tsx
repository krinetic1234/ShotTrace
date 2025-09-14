import React from "react";
import Collapsible from "@/components/ui/Collapsible";

export default function JobReportPanel({ jobReport }: { jobReport: any }) {
  if (!jobReport) return null;
  
  return (
    <Collapsible title="Job Report">
      <pre className="text-sm bg-black/40 p-4 rounded-lg overflow-auto max-h-80 leading-relaxed">
        {JSON.stringify(jobReport, null, 2)}
      </pre>
    </Collapsible>
  );
}
