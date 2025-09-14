import React from "react";
import Collapsible from "@/components/ui/Collapsible";

export default function LogsPanel({ logs, filterTerm }: { logs: string; filterTerm?: string }) {
  const filteredLogs = filterTerm 
    ? logs.split('\n').filter(line => line.includes(filterTerm)).join('\n')
    : logs;
    
  return (
    <Collapsible title="Logs">
      <pre className="text-xs bg-black/50 text-green-200 p-4 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap leading-relaxed">
        {filteredLogs}
      </pre>
    </Collapsible>
  );
}
