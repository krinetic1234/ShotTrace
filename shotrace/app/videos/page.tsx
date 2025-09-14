"use client";

import React, { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ShotTraceHeader from "@/components/shells/ShotTraceHeader";
import { useJobStream } from "@/app/hooks/useJobStream";
import { useUploads } from "@/hooks/useUploads";
import { fileUrl, videoRoute } from "@/lib/routes";
import PageHeader from "@/components/shells/PageHeader";
import PageSection from "@/components/shells/PageSection";
import Card from "@/components/shells/Card";
import SourceVideoCard from "@/components/shells/SourceVideoCard";
import SectionLabel from "@/components/ui/SectionLabel";
import MiniStat from "@/components/ui/MiniStat";
import StatusPill from "@/components/ui/StatusPill";
import ProgressBar from "@/components/ui/ProgressBar";
import SparkDots from "@/components/streams/SparkDots";
import UploadsPanel from "@/components/panels/UploadsPanel";
import JobReportPanel from "@/components/panels/JobReportPanel";
import LogsPanel from "@/components/panels/LogsPanel";
import SummaryArtifacts from "@/components/panels/SummaryArtifacts";

export default function VideosPage() {
  const searchParams = useSearchParams();
  const job = searchParams.get("job") || "";
  
  const { videos, jobReport, logs } = useJobStream(job);
  const { processed, raw } = useUploads(job);

  // if no job is selected, show a message
  if (!job) {
    return (
      <div className="min-h-screen">
        <ShotTraceHeader />
        <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
          <PageHeader title="Please select a job from the dropdown" />
        </main>
      </div>
    );
  }

  const stats = useMemo(() => {
    const totalVideos = videos.length;
    const summariesReady = videos.filter(v => v.videoSummaryReady).length;
    const totalChunks = videos.reduce((sum, v) => sum + v.chunksDone, 0);
    return { totalVideos, summariesReady, totalChunks };
  }, [videos]);

  const openArtifact = (job: string, videoStem: string, filename: string) => {
    const url = fileUrl(job, `summaries/${encodeURIComponent(videoStem)}/${filename}`, "results");
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen">
      <ShotTraceHeader />
      <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
        <PageHeader 
          title="Source Videos" 
          subtitle="Parallel streams of chunking, detection, and synthesis"
        />

      {/* Overview Stats */}
      <PageSection>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <MiniStat 
            label="Videos" 
            value={stats.totalVideos}
            pill={{ label: "active", state: "active" }}
          />
          <MiniStat 
            label="Summaries Ready" 
            value={stats.summariesReady}
            pill={{ label: "complete", state: "complete" }}
          />
          <MiniStat 
            label="Total Chunks" 
            value={stats.totalChunks}
          />
        </div>
      </PageSection>

      {/* Videos Grid */}
      <PageSection title="Videos">
        {videos.length === 0 ? (
          <Card>
            <div className="text-center text-gray-400 py-8">
              No videos found for job "{job}". Check uploads or try a different job.
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))'}}>
            {videos.map(v => {
              const videoStem = v.video.replace(/\.[^/.]+$/, ""); // Remove extension
              const progress = Math.min(100, v.chunksDone); // Assume soft target of 100 for now
              
              return (
                <SourceVideoCard
                  key={v.video}
                  title={v.video}
                  badges={(
                    <>
                      <StatusPill label={`${v.chunksDone} chunks`} state="active" />
                      {v.videoSummaryReady && <StatusPill label="Summary" state="complete" />}
                    </>
                  )}
                >
                  <div>
                    <SectionLabel>Processing Progress</SectionLabel>
                    <ProgressBar percent={progress} ariaLabel={`Processing progress: ${progress}%`} />
                  </div>

                  <div>
                    <SectionLabel>Video Comparison</SectionLabel>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                      <div>
                        <div className="text-xs text-white/60 mb-1.5">Original</div>
                        <div className="aspect-video rounded-lg ring-1 ring-white/10 overflow-hidden bg-gray-800/30">
                          {v.originalRel ? (
                            <video
                              src={fileUrl(job, v.originalRel, "videos")}
                              className="w-full h-full object-cover"
                              controls
                              muted
                              preload="metadata"
                              aria-label="Original video"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">No original</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-white/60 mb-1.5">Latest Chunk</div>
                        <div className="aspect-video rounded-lg ring-1 ring-white/10 overflow-hidden bg-gray-800/30">
                          {v.lastChunkVideoRel ? (
                            <video
                              src={fileUrl(job, v.lastChunkVideoRel, "results")}
                              className="w-full h-full object-cover"
                              controls
                              muted
                              preload="metadata"
                              aria-label="Latest chunk video"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">Processing...</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <SectionLabel>Chunk Timeline</SectionLabel>
                    <div className="mt-1">
                      <SparkDots
                        count={v.chunkList?.length || 0}
                        activeIndex={v.chunkList?.length ? v.chunkList.length - 1 : -1}
                        maxDots={20}
                      />
                    </div>
                  </div>

                  <div>
                    <SectionLabel>Summary Artifacts</SectionLabel>
                    <SummaryArtifacts
                      summaryReady={v.videoSummaryReady}
                      responderCard={v.responderCard}
                      operationsPlan={v.operationsPlan}
                      onOpenResponder={() => openArtifact(job, videoStem, "responder_card.json")}
                      onOpenOpsPlan={() => openArtifact(job, videoStem, "operations_plan.json")}
                    />
                    {v.videoSummaryDigest && (
                      <div className="text-xs text-white/50 mt-1">Timeline: {v.videoSummaryDigest.timelineLen} points</div>
                    )}
                  </div>

                  <div className="pt-1">
                    <Link
                      href={videoRoute(v.video, job)}
                      className="inline-block w-full md:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30 text-sky-200 text-center transition-all duration-300 font-semibold border border-sky-500/20 hover:border-sky-400/40 hover:shadow-lg hover:shadow-sky-500/20"
                    >
                      Open Chunk Explorer →
                    </Link>
                  </div>
                </SourceVideoCard>
              );
            })}
          </div>
        )}
      </PageSection>

      {/* Live Logs Inline (global job logs) */}
      <PageSection title="Live Logs">
        <Card>
          <pre className="text-xs font-mono whitespace-pre-wrap text-white/80 max-h-72 overflow-auto">
{logs}
          </pre>
        </Card>
      </PageSection>

      {/* Panels */}
      <PageSection>
        <div className="space-y-8 mt-16">
          <UploadsPanel job={job} processed={processed} raw={raw} />
          <JobReportPanel jobReport={jobReport} />
          <LogsPanel logs={logs} />
        </div>
      </PageSection>
      </main>
    </div>
  );
}
