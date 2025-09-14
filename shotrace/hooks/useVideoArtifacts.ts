"use client";

import { useCallback, useRef, useState } from "react";
import { fileUrl } from "@/lib/routes";

export function useVideoArtifacts(job: string, videoStem: string) {
  const [summaryJson, setSummaryJson] = useState<any | null>(null);
  const [clipJson, setClipJson] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState<{ summary?: boolean; clip?: boolean }>({});
  const summaryLoaded = useRef<boolean>(false);
  const clipsLoaded = useRef<Set<number>>(new Set());

  const loadSummary = useCallback(async () => {
    if (!job || !videoStem || summaryLoaded.current) return;
    setLoading((s) => ({ ...s, summary: true }));
    try {
      const rel = `summaries/${encodeURIComponent(videoStem)}/video_summary.json`;
      const r = await fetch(fileUrl(job, rel, "results"));
      if (r.ok) {
        const j = await r.json();
        setSummaryJson(j);
        summaryLoaded.current = true;
      }
    } finally {
      setLoading((s) => ({ ...s, summary: false }));
    }
  }, [job, videoStem]);

  const loadClip = useCallback(async (index: number) => {
    if (!job || !videoStem || clipsLoaded.current.has(index)) return;
    setLoading((s) => ({ ...s, clip: true }));
    try {
      const rel = `summaries/${encodeURIComponent(videoStem)}/clip_${index}.json`;
      const r = await fetch(fileUrl(job, rel, "results"));
      if (r.ok) {
        const j = await r.json();
        setClipJson((prev) => ({ ...prev, [index]: j }));
        clipsLoaded.current.add(index);
      }
    } finally {
      setLoading((s) => ({ ...s, clip: false }));
    }
  }, [job, videoStem]);

  return { summaryJson, clipJson, loadSummary, loadClip, loading } as const;
}


