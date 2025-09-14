"use client";

import { useEffect, useMemo, useState } from "react";

export type ChunkEvent = {
  video: string;
  chunkIndex?: number;
  summary: any;
};

type VideoState = {
  chunksDone: number;
  lastChunk?: ChunkEvent;
  videoSummaryReady: boolean;
  videoSummaryDigest?: any;
  responderCard?: any;
  operationsPlan?: any;
  lastChunkVideoRel?: string;
  chunkList?: Array<{ index?: number; relPath?: string }>;
};

export function useJobStream(job: string) {
  const [videos, setVideos] = useState<Record<string, VideoState>>({});
  const [jobReport, setJobReport] = useState<any>(null);
  const [logs, setLogs] = useState<string>("");
  const [originals, setOriginals] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!job) return; // Don't start SSE if no job is provided
    
    const es = new EventSource(`/api/events?job=${encodeURIComponent(job)}`);

    es.addEventListener("chunkCompleted", ((ev: MessageEvent) => {
      const payload = JSON.parse(ev.data);
      const video = payload.video;
      const chunkIndex = payload.chunkIndex;
      const summary = payload.digest ?? payload.summary; // prefer compact digest
      setVideos(prev => {
        const v = prev[video] || { chunksDone: 0, videoSummaryReady: false } as VideoState;
        return {
          ...prev,
          [video]: {
            ...v,
            chunksDone: (v.chunksDone || 0) + 1,
            lastChunk: { video, chunkIndex, summary },
          }
        };
      });
    }) as EventListener);

    es.addEventListener("videoSummaryReady", ((ev: MessageEvent) => {
      const { video, digest } = JSON.parse(ev.data);
      setVideos(prev => ({ ...prev, [video]: { ...(prev[video] || { chunksDone: 0 }), videoSummaryReady: true, videoSummaryDigest: digest } }));
    }) as EventListener);

    es.addEventListener("responderCardReady", ((ev: MessageEvent) => {
      const { video, data } = JSON.parse(ev.data);
      setVideos(prev => ({ ...prev, [video]: { ...(prev[video] || { chunksDone: 0 }), responderCard: data } }));
    }) as EventListener);

    es.addEventListener("operationsPlanReady", ((ev: MessageEvent) => {
      const { video, data } = JSON.parse(ev.data);
      setVideos(prev => ({ ...prev, [video]: { ...(prev[video] || { chunksDone: 0 }), operationsPlan: data } }));
    }) as EventListener);

    es.addEventListener("jobReportReady", ((ev: MessageEvent) => {
      const { data } = JSON.parse(ev.data);
      setJobReport(data);
    }) as EventListener);

    es.addEventListener("log", ((ev: MessageEvent) => {
      const { tail } = JSON.parse(ev.data);
      setLogs(tail);
    }) as EventListener);

    es.addEventListener("chunkCreated", ((ev: MessageEvent) => {
      const { video, relPath } = JSON.parse(ev.data);
      setVideos(prev => ({
        ...prev,
        [video]: {
          ...(prev[video] || { chunksDone: 0, videoSummaryReady: false }),
          lastChunkVideoRel: relPath,
          chunkList: [...(prev[video]?.chunkList || []), { relPath }].slice(-50),
        },
      }));
    }) as EventListener);

    es.addEventListener("originalVideo", ((ev: MessageEvent) => {
      try {
        const { video, relPath } = JSON.parse(ev.data || "{}");
        if (!video) return;
        setOriginals(prev => ({ ...prev, [video]: relPath }));
        setVideos(prev => ({
          ...prev,
          [video]: {
            ...(prev[video] || { chunksDone: 0, videoSummaryReady: false }),
          },
        }));
      } catch {
      }
    }) as EventListener);

    es.addEventListener("error", ((ev: MessageEvent) => {
      // quiet transient SSE errors; browser will auto-reconnect
      // eslint-disable-next-line no-console
      console.debug("sse transient error", ev);
    }) as EventListener);

    return () => es.close();
  }, [job]);

  const list = useMemo(() => {
    const keys = new Set<string>([...Object.keys(videos), ...Object.keys(originals)]);
    return Array.from(keys).map((video) => ({ video, ...(videos[video] || { chunksDone: 0, videoSummaryReady: false }), originalRel: originals[video] }));
  }, [videos, originals]);
  return { videos: list, jobReport, logs };
}


