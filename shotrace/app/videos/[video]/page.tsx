"use client";

import React, { useMemo, useState, useEffect, useCallback, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ShotTraceHeader from "@/components/shells/ShotTraceHeader";
import { useJobStream } from "@/app/hooks/useJobStream";
import { useVideoArtifacts } from "@/hooks/useVideoArtifacts";
import { fileUrl, videosRoute, getChunkIndexFromUrl, setChunkIndexInUrl } from "@/lib/routes";
import type { Stage } from "@/components/streams/Swimlane";
import PageHeader from "@/components/shells/PageHeader";
import PageSection from "@/components/shells/PageSection";
import Card from "@/components/shells/Card";
import Swimlane from "@/components/streams/Swimlane";
import ChunkTimeline from "@/components/streams/ChunkTimeline";
import VideoBox from "@/components/media/VideoBox";
import KeyValue from "@/components/ui/KeyValue";
import Collapsible from "@/components/ui/Collapsible";
import SummaryArtifacts from "@/components/panels/SummaryArtifacts";
import JobReportPanel from "@/components/panels/JobReportPanel";
import LogsPanel from "@/components/panels/LogsPanel";
import SectionLabel from "@/components/ui/SectionLabel";
import Modal from "@/components/ui/Modal";

export default function ChunkExplorerPage({ params }: { params: Promise<{ video: string }> }) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const job = searchParams.get("job") || "";
  const videoFilename = decodeURIComponent(resolvedParams.video);
  const videoStem = videoFilename.replace(/\.[^/.]+$/, ""); // Remove extension
  
  const { videos, jobReport, logs } = useJobStream(job);
  const { summaryJson, clipJson, loadSummary, loadClip } = useVideoArtifacts(job, videoStem);
  
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number>(() => {
    return getChunkIndexFromUrl() ?? 0;
  });
  const [activeTab, setActiveTab] = useState<"preview" | "detections" | "vlm" | "summary">("preview");
  const [logsOpen, setLogsOpen] = useState<boolean>(false);

  // Find the video data
  const videoData = useMemo(() => 
    videos.find(v => v.video === videoFilename), 
    [videos, videoFilename]
  );

  // Derive stages for swimlane
  const stages = useMemo((): Stage[] => {
    if (!videoData) return [];
    
    const chunkTotal = Math.max(videoData.chunksDone, 10); // Assume soft target
    const detectionsDone = videoData.lastChunk?.summary?.framesCount ? videoData.chunksDone : 0;
    const synthesisDone = videoData.videoSummaryReady ? 1 : 0;
    
    return [
      {
        id: "chunking",
        label: "Chunking",
        done: videoData.chunksDone,
        total: chunkTotal,
        state: videoData.chunksDone > 0 ? "active" : "idle",
      },
      {
        id: "detection",
        label: "Detection",
        done: detectionsDone,
        total: videoData.chunksDone,
        state: detectionsDone > 0 ? "active" : "idle",
      },
      {
        id: "synthesis",
        label: "Synthesis",
        done: synthesisDone,
        total: 1,
        state: videoData.videoSummaryReady ? "complete" : "idle",
      },
    ];
  }, [videoData]);

  // Timeline items
  const timelineItems = useMemo(() => {
    if (!videoData?.chunkList) return [];
    return videoData.chunkList.map((chunk, i) => ({
      index: chunk.index ?? i,
      relPath: chunk.relPath,
    }));
  }, [videoData?.chunkList]);

  // Selected chunk data
  const selectedChunk = useMemo(() => {
    if (!videoData?.chunkList) return null;
    return videoData.chunkList.find((_, i) => i === selectedChunkIndex) || videoData.chunkList[0];
  }, [videoData?.chunkList, selectedChunkIndex]);

  const selectedChunkSummary = useMemo(() => {
    if (!videoData?.lastChunk || videoData.lastChunk.chunkIndex !== selectedChunkIndex) return null;
    return videoData.lastChunk.summary;
  }, [videoData?.lastChunk, selectedChunkIndex]);

  // Auto-advance selection to latest chunk when new chunks arrive
  useEffect(() => {
    const len = videoData?.chunkList?.length || 0;
    if (len === 0) return;
    const latest = len - 1;
    if (selectedChunkIndex !== latest) {
      setSelectedChunkIndex(latest);
      setChunkIndexInUrl(latest);
    }
  }, [videoData?.chunkList?.length]);

  // Update URL when chunk selection changes
  const handleChunkChange = useCallback((index: number) => {
    setSelectedChunkIndex(index);
    setChunkIndexInUrl(index);
  }, []);

  // Load artifacts on demand
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === "summary") {
      loadSummary();
      if (selectedChunk) {
        loadClip(selectedChunk.index ?? selectedChunkIndex);
      }
    }
  };

  const openArtifact = (filename: string) => {
    const url = fileUrl(job, `summaries/${encodeURIComponent(videoStem)}/${filename}`, "results");
    window.open(url, '_blank');
  };

  // If Summary tab is open and chunk selection changes, (re)load clip and summary
  useEffect(() => {
    if (activeTab === "summary") {
      loadClip(selectedChunkIndex);
      loadSummary();
    }
  }, [activeTab, selectedChunkIndex, loadClip, loadSummary]);

  if (!videoData) {
    return (
      <div className="min-h-screen">
        <ShotTraceHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageHeader title="Video Not Found" />
          <Card>
            <div className="text-center text-gray-400 py-8">
              Video "{videoFilename}" not found in job "{job}".{" "}
              <Link href={videosRoute(job)} className="text-sky-400 hover:text-sky-300">
                ← Back to Videos
              </Link>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ShotTraceHeader />
      <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
        <div className="mb-6">
          <Link
            href={videosRoute(job)}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-colors"
            aria-label="Back to Source Videos"
          >
            <span>← Back</span>
            <span className="text-white/70">Videos</span>
          </Link>
        </div>
        <div className="mb-16">
          <div className="flex items-center gap-3 text-5xl font-bold text-white mb-4 tracking-tight">
            <Link href={videosRoute(job)} className="text-gray-400 hover:text-white transition-all duration-300 hover:text-sky-300">
              Videos
            </Link>
            <span className="text-gray-500">/</span>
            <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">{videoFilename}</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xl text-gray-300 font-medium leading-relaxed max-w-3xl">Deep dive into parallel processing pipeline with real-time chunk analysis</p>
            <button
              onClick={() => setLogsOpen(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white"
              aria-label="Open Live Logs"
            >
              Live Logs
            </button>
          </div>
        </div>

      {/* Swimlane */}
      <PageSection>
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-8 tracking-tight">Processing Pipeline</h2>
          <Swimlane stages={stages} />
        </div>
      </PageSection>

      {/* Live Logs Modal */}
      <Modal open={logsOpen} onClose={() => setLogsOpen(false)} title={`Live Logs — ${videoStem}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-white/5 ring-1 ring-white/10">
            <div className="text-xs text-white/70 mb-2">Chunking</div>
            <div className="text-xs font-mono whitespace-pre-wrap text-white/80 max-h-56 overflow-auto">
{logs?.split("\n").filter(l => l.includes("chunk") || l.includes("segment")).slice(-50).join("\n")}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 ring-1 ring-white/10">
            <div className="text-xs text-white/70 mb-2">Detection</div>
            <div className="text-xs font-mono whitespace-pre-wrap text-white/80 max-h-56 overflow-auto">
{logs?.split("\n").filter(l => l.toLowerCase().includes("yolo") || l.toLowerCase().includes("detect")).slice(-50).join("\n")}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 ring-1 ring-white/10">
            <div className="text-xs text-white/70 mb-2">Synthesis</div>
            <div className="text-xs font-mono whitespace-pre-wrap text-white/80 max-h-56 overflow-auto">
{logs?.split("\n").filter(l => l.toLowerCase().includes("vlm") || l.toLowerCase().includes("summary") || l.toLowerCase().includes("card") || l.toLowerCase().includes("plan")).slice(-50).join("\n")}
            </div>
          </div>
        </div>
      </Modal>

      {/* Timeline */}
      <PageSection>
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-8 tracking-tight">Chunk Timeline</h2>
          <ChunkTimeline 
            items={timelineItems}
            activeIndex={selectedChunkIndex}
            onChange={handleChunkChange}
          />
        </div>
      </PageSection>

      {/* Inspector */}
      <PageSection>
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-8 tracking-tight">Inspector</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left: Preview */}
          <div className="lg:col-span-2">
            <Card className="border-white/10 hover:border-sky-400/30 transition-all duration-300 leading-[1.35]">
              <div className="flex items-center gap-6 pb-4 md:pb-5 border-b border-white/10">
                {(["preview", "detections", "vlm", "summary"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`px-4 py-2.5 text-sm rounded-lg font-medium transition-all duration-200 ${
                      activeTab === tab 
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-lg shadow-sky-500/20' 
                        : 'text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <div className="pt-4 md:pt-5 space-y-4 md:space-y-5 min-h-[400px]">
                {activeTab === "preview" && (
                  <div className="space-y-4 md:space-y-5">
                    <div className="space-y-3">
                      <SectionLabel>Chunk {selectedChunkIndex} Preview</SectionLabel>
                      <div className="aspect-video bg-gray-800/30 rounded-lg overflow-hidden ring-1 ring-white/10">
                        {selectedChunk?.relPath ? (
                          <video 
                            src={fileUrl(job, selectedChunk.relPath, "results")} 
                            className="w-full h-full object-cover"
                            controls 
                            muted 
                            preload="metadata"
                            aria-label={`Chunk ${selectedChunkIndex} video`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500">
                            Select a chunk to preview
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-center pt-4 border-t border-white/10">
                      <button
                        onClick={() => videoData.originalRel && window.open(fileUrl(job, videoData.originalRel, "videos"), '_blank')}
                        disabled={!videoData.originalRel}
                        className="px-4 py-2 text-sm text-sky-400 hover:text-sky-300 disabled:text-gray-500 disabled:cursor-not-allowed border border-sky-400/30 rounded-lg hover:bg-sky-500/10 transition-all duration-200"
                      >
                        Open Original in New Tab ↗
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === "detections" && selectedChunkSummary && (
                  <div className="space-y-4 md:space-y-5">
                    <div className="space-y-3">
                      <SectionLabel>Detection Statistics</SectionLabel>
                      <KeyValue items={[
                        { key: "Frames", value: String(selectedChunkSummary.framesCount || 0) },
                        { key: "Tracklets", value: String(selectedChunkSummary.trackletsCount || 0) },
                      ]} />
                    </div>
                    
                    {selectedChunkSummary.perClassCounts && (
                      <div className="space-y-3">
                        <SectionLabel>Detection Counts</SectionLabel>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(selectedChunkSummary.perClassCounts).map(([cls, count]) => (
                            <span key={cls} className="chip bg-gray-800/40 border-gray-600/40">
                              {cls}: <span className="font-medium">{String(count)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selectedChunkSummary.topDetections && (
                      <div className="space-y-3">
                        <SectionLabel>Top Detections</SectionLabel>
                        <div className="space-y-2 bg-gray-800/20 rounded-lg p-4">
                          {selectedChunkSummary.topDetections.slice(0, 5).map((det: any, i: number) => (
                            <div key={i} className="text-sm text-gray-300 flex justify-between items-center py-1">
                              <span className="font-medium">{det.cls}</span>
                              <span className="text-sky-400 font-semibold">{(det.conf * 100).toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "vlm" && selectedChunkSummary?.vlm && (
                  <div className="space-y-4 md:space-y-5">
                    <SectionLabel>Visual Language Model Analysis</SectionLabel>

                    {selectedChunkSummary.vlm.entities && (
                      <div className="space-y-2 p-4 bg-gray-800/20 rounded-lg">
                        <div className="text-sm font-medium text-white">Entities</div>
                        <div className="text-sm text-gray-300 leading-relaxed space-y-1">
                          {typeof selectedChunkSummary.vlm.entities.people_count === "number" && (
                            <div>People: <span className="font-semibold">{selectedChunkSummary.vlm.entities.people_count}</span></div>
                          )}
                          {Array.isArray(selectedChunkSummary.vlm.entities.vehicles_summary) && selectedChunkSummary.vlm.entities.vehicles_summary.length > 0 && (
                            <div>
                              Vehicles:
                              <ul className="list-disc list-inside text-gray-300 mt-1">
                                {selectedChunkSummary.vlm.entities.vehicles_summary.map((v: any, i: number) => (
                                  <li key={i}>{v.type}: ~{v.approx_count}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {Array.isArray(selectedChunkSummary.vlm.actions_summary) && selectedChunkSummary.vlm.actions_summary.length > 0 && (
                      <div className="space-y-2 p-4 bg-gray-800/20 rounded-lg">
                        <div className="text-sm font-medium text-white">Actions</div>
                        <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                          {selectedChunkSummary.vlm.actions_summary.map((a: string, i: number) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedChunkSummary.vlm.movement && (
                      <div className="space-y-2 p-4 bg-gray-800/20 rounded-lg">
                        <div className="text-sm font-medium text-white">Movement</div>
                        <div className="text-sm text-gray-300 leading-relaxed grid grid-cols-2 gap-2">
                          {selectedChunkSummary.vlm.movement.dominant_direction && (<div>Direction: {selectedChunkSummary.vlm.movement.dominant_direction}</div>)}
                          {selectedChunkSummary.vlm.movement.speed_hint && (<div>Speed: {selectedChunkSummary.vlm.movement.speed_hint}</div>)}
                          {typeof selectedChunkSummary.vlm.movement.direction_changes === "boolean" && (
                            <div>Direction Changes: {selectedChunkSummary.vlm.movement.direction_changes ? "yes" : "no"}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {Array.isArray(selectedChunkSummary.vlm.notable) && selectedChunkSummary.vlm.notable.length > 0 && (
                      <div className="space-y-2 p-4 bg-amber-900/20 rounded-lg border border-amber-500/20">
                        <div className="text-sm font-medium text-amber-200">Notable Observations</div>
                        <ul className="list-disc list-inside text-sm text-amber-100 space-y-1">
                          {selectedChunkSummary.vlm.notable.map((n: string, i: number) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "summary" && (
                  <div className="space-y-4 md:space-y-5">
                    <SectionLabel>Summary</SectionLabel>
                    <div className="text-sm text-gray-300 leading-relaxed">
                      {selectedChunkSummary?.synopsis
                        || (Array.isArray((summaryJson as any)?.clip_summaries)
                              ? (summaryJson as any).clip_summaries.find((c: any) => c?.chunk_index === selectedChunkIndex)?.synopsis
                              : null)
                        || "No synopsis available."}
                    </div>

                    
                    <Collapsible title="Full JSON">
                      <div className="bg-black/40 rounded-lg p-4 border border-white/10">
                        <pre className="text-xs text-green-200 overflow-auto max-h-64 leading-relaxed">
                          {summaryJson 
                            ? JSON.stringify(summaryJson, null, 2)
                            : "Loading..."
                          }
                        </pre>
                      </div>
                    </Collapsible>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right: Metadata */}
          <div className="space-y-8">
            <SummaryArtifacts 
              summaryReady={videoData.videoSummaryReady}
              responderCard={videoData.responderCard}
              operationsPlan={videoData.operationsPlan}
              onOpenResponder={() => openArtifact("responder_card.json")}
              onOpenOpsPlan={() => openArtifact("operations_plan.json")}
            />
            
            {videoData.videoSummaryDigest && (
              <Card className="border-white/10 hover:border-sky-400/30 transition-all duration-300">
                <div className="text-lg font-semibold text-white mb-6 tracking-tight">Video Summary</div>
                <KeyValue items={[
                  { key: "Timeline Points", value: String(videoData.videoSummaryDigest.timelineLen || 0) },
                  ...(videoData.videoSummaryDigest.lastSeen ? [
                    { key: "Last Seen", value: `${videoData.videoSummaryDigest.lastSeen.cls} @ ${videoData.videoSummaryDigest.lastSeen.t_abs_sec}s` }
                  ] : [])
                ]} />
              </Card>
            )}
          </div>
        </div>
        </div>
      </PageSection>

      {/* Secondary Panels */}
      <PageSection>
        <div className="space-y-8 mt-16">
          <JobReportPanel jobReport={jobReport} />
          <LogsPanel logs={logs} filterTerm={videoStem} />
        </div>
      </PageSection>
      </main>
    </div>
  );
}
