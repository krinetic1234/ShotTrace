"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch available jobs and redirect to the first one
    fetch("/api/jobs")
      .then(r => r.json())
      .then(data => {
        const jobs = data.jobs || [];
        const defaultJob = jobs.length > 0 ? jobs[0] : "kirk";
        router.replace(`/videos?job=${encodeURIComponent(defaultJob)}`);
      })
      .catch(() => {
        // Fallback if API fails
        router.replace("/videos?job=kirk");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center space-y-8 max-w-md mx-auto px-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 glass border-2 border-white/20 shadow-2xl" style={{background:"linear-gradient(135deg, var(--surface), rgba(125, 211, 252, 0.1))"}}>
            <span className="text-white font-bold text-3xl tracking-tight">ST</span>
          </div>
          <div className="absolute -inset-2 bg-gradient-to-r from-sky-500/20 to-violet-500/20 rounded-3xl blur-xl opacity-60"></div>
        </div>
        
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-white tracking-tight">ShotTrace</h1>
          <p className="text-lg text-gray-300 font-medium">Initializing emergency response system...</p>
        </div>
        
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
          <div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
        </div>
      </div>
    </div>
  );
}
