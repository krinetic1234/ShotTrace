"use client";

import { useEffect, useState } from "react";
import type { JobsResponse } from "@/lib/types";

export function useJobs() {
  const [jobs, setJobs] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/jobs")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d: JobsResponse) => {
        if (!cancelled) setJobs(d.jobs || []);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { jobs, loading, error } as const;
}


