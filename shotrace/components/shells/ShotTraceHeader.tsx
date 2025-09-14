"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useJobs } from "@/hooks/useJobs";
import StatusPill from "@/components/ui/StatusPill";

export default function ShotTraceHeader() {
  const searchParams = useSearchParams();
  const { jobs } = useJobs();
  const currentJob = searchParams.get("job") || "";

  return (
    <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center space-x-4">
            <Link href="/videos" className="flex items-center space-x-4 hover:opacity-80 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center glass border border-white/20 group-hover:border-sky-400/40 transition-all duration-300" style={{background:"linear-gradient(135deg, var(--surface), rgba(125, 211, 252, 0.1))"}}>
                <span className="text-white font-bold text-xl tracking-tight">ST</span>
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-white tracking-tight">ShotTrace</h1>
                <p className="text-xs text-gray-400 font-medium">Emergency Response System</p>
              </div>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <select 
              value={currentJob}
              onChange={(e) => {
                const next = e.target.value;
                const url = new URL(window.location.href);
                if (!next) {
                  url.searchParams.delete("job");
                } else {
                  url.searchParams.set("job", next);
                }
                window.location.href = url.toString();
              }}
              className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-4 py-2.5 font-medium hover:bg-white/15 transition-colors focus:ring-2 focus:ring-sky-500/50 focus:border-sky-400"
              aria-label="Select job"
            >
              <option value="" className="bg-slate-800">No Job</option>
              {jobs.map(j => (<option key={j} value={j} className="bg-slate-800">{j}</option>))}
            </select>
            <StatusPill label="Live" state="active" pulse />
          </div>
        </div>
      </div>
    </header>
  );
}
