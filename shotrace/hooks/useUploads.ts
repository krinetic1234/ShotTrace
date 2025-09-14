"use client";

import { useEffect, useState } from "react";
import type { VideosResponse } from "@/lib/types";

export function useUploads(job: string) {
  const [processed, setProcessed] = useState<string[]>([]);
  const [raw, setRaw] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job) {
      setProcessed([]);
      setRaw([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/videos?job=${encodeURIComponent(job)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d: VideosResponse) => {
        if (cancelled) return;
        setProcessed(d.processed || []);
        setRaw(d.raw || []);
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
  }, [job]);

  return { processed, raw, loading, error } as const;
}


