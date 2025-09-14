export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

function sseInit(controller: ReadableStreamDefaultController) {
  const encoder = new TextEncoder();
  const send = (event: string, data: unknown) => {
    controller.enqueue(encoder.encode(`event: ${event}\n`));
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };
  return { send };
}

export async function GET(req: NextRequest) {
  const job = req.nextUrl.searchParams.get("job") || "kirk";
  // default points to the footage_analysis results dir one level up
  const base = process.env.RESULTS_BASE_DIR || path.resolve(process.cwd(), "../footage_analysis/data/results");
  const resultsDir = path.join(base, job);
  const videosBase = process.env.VIDEOS_BASE_DIR || path.resolve(process.cwd(), "../footage_analysis/data/videos");

  if (!fs.existsSync(resultsDir)) {
    return new Response(`results dir not found: ${resultsDir}`, { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const chokidar = (await import("chokidar")).default;
      const { send } = sseInit(controller);

      send("jobStarted", { jobName: job, resultsDir });
      // Discover original videos for this job and announce them
      try {
        const jobVideosDir = path.join(videosBase, job, "processed");
        if (fs.existsSync(jobVideosDir)) {
          const files = fs.readdirSync(jobVideosDir).filter(f => f.endsWith(".mp4"));
          for (const f of files) {
            send("originalVideo", { video: path.basename(f, ".mp4"), relPath: path.join("processed", f) });
          }
        }
      } catch (e: any) {
        send("error", { scope: "init", message: e?.message || String(e) });
      }

      const watcher = chokidar.watch(
        [
          path.join(resultsDir, "summaries", "**", "clip_*.json"),
          path.join(resultsDir, "summaries", "**", "video_summary.json"),
          path.join(resultsDir, "summaries", "**", "operations_plan.json"),
          path.join(resultsDir, "summaries", "**", "responder_card.json"),
          path.join(resultsDir, "chunks", "**", "*.mp4"),
          path.join(resultsDir, "job_report.json"),
          path.join(resultsDir, "job.log"),
        ],
        { ignoreInitial: false, awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 } }
      );

      const debounced = new Map<string, NodeJS.Timeout>();
      const enqueue = (filePath: string) => {
        clearTimeout(debounced.get(filePath) as NodeJS.Timeout);
        const t = setTimeout(() => {
          try {
            if (filePath.endsWith(".json")) {
              const raw = fs.readFileSync(filePath, "utf-8");
              const data = JSON.parse(raw);
              if (filePath.includes("clip_")) {
                const m = filePath.match(/clip_(\d+)\.json/);
                const chunkIndex = m ? Number(m[1]) : undefined;
                // Build a compact digest so we don't ship massive payloads to the UI
                try {
                  const frames = Array.isArray(data.frames) ? data.frames : [];
                  const startSec = typeof data.start_sec === "number" ? data.start_sec : undefined;
                  const endSec = typeof data.end_sec === "number" ? data.end_sec : undefined;
                  const perClass: Record<string, number> = {};
                  const sample: Array<{ cls: string; conf: number; track_id?: number; t_abs_sec?: number; bbox_xyxy?: number[] }>
                    = [];
                  for (const fr of frames) {
                    const ms = typeof fr.ms_from_chunk_start === "number" ? fr.ms_from_chunk_start : 0;
                    const tAbs = startSec != null ? startSec + ms / 1000.0 : undefined;
                    const dets = Array.isArray(fr.detections) ? fr.detections : [];
                    for (const d of dets) {
                      const cls = d?.cls ?? "unknown";
                      perClass[cls] = (perClass[cls] || 0) + 1;
                      const conf = typeof d?.conf === "number" ? d.conf : 0;
                      const bbox = Array.isArray(d?.bbox_xyxy) ? d.bbox_xyxy : undefined;
                      sample.push({ cls, conf, track_id: d?.track_id, t_abs_sec: tAbs, bbox_xyxy: bbox });
                    }
                  }
                  sample.sort((a, b) => (b.conf - a.conf));
                  const top5 = sample.slice(0, 5);
                  // pick first VLM json if present
                  let vlm: any = null;
                  for (const fr of frames) {
                    if (fr && fr.vlm_json) { vlm = fr.vlm_json; break; }
                  }
                  const digest = {
                    startSec,
                    endSec,
                    framesCount: frames.length,
                    trackletsCount: data?.tracklets ? Object.keys(data.tracklets).length : 0,
                    perClassCounts: perClass,
                    topDetections: top5,
                    synopsis: data?.synopsis ?? null,
                    vlm: vlm ? {
                      entities: vlm.entities ?? null,
                      actions_summary: vlm.actions_summary ?? null,
                      movement: vlm.movement ?? null,
                      notable: vlm.notable ?? null,
                      quality: vlm.quality ?? null,
                      confidence: vlm.confidence ?? null,
                    } : null,
                  };
                  send("chunkCompleted", {
                    video: path.basename(path.dirname(filePath)),
                    chunkIndex,
                    digest,
                  });
                } catch (e: any) {
                  // fallback to raw if digest fails
                  send("chunkCompleted", {
                    video: path.basename(path.dirname(filePath)),
                    chunkIndex,
                    summary: data,
                  });
                }
              } else if (filePath.endsWith("video_summary.json")) {
                try {
                  const timeline = Array.isArray(data?.combined_timeline) ? data.combined_timeline : [];
                  const perClass: Record<string, number> = {};
                  for (const t of timeline) {
                    const cls = t?.cls ?? "unknown";
                    perClass[cls] = (perClass[cls] || 0) + 1;
                  }
                  const last = timeline.length ? timeline[timeline.length - 1] : null;
                  const lastSeen = last ? {
                    t_abs_sec: last.t_abs_sec,
                    track_id: last.track_id,
                    cls: last.cls,
                    chunk: last.chunk,
                  } : null;
                  send("videoSummaryReady", {
                    video: path.basename(path.dirname(filePath)),
                    path: filePath,
                    digest: { timelineLen: timeline.length, perClassCounts: perClass, lastSeen },
                  });
                } catch {
                  send("videoSummaryReady", {
                    video: path.basename(path.dirname(filePath)),
                    path: filePath,
                  });
                }
              } else if (filePath.endsWith("responder_card.json")) {
                send("responderCardReady", { video: path.basename(path.dirname(filePath)), path: filePath, data });
              } else if (filePath.endsWith("operations_plan.json")) {
                send("operationsPlanReady", { video: path.basename(path.dirname(filePath)), path: filePath, data });
              } else if (filePath.endsWith("job_report.json")) {
                send("jobReportReady", { path: filePath, data });
              }
            } else if (filePath.endsWith(".log")) {
              const snippet = fs.readFileSync(filePath, "utf-8").slice(-5000);
              send("log", { path: filePath, tail: snippet });
            }
          } catch (e: any) {
            send("error", { scope: "watcher", message: e?.message || String(e) });
          }
        }, 120);
        debounced.set(filePath, t);
      };

      watcher
        .on("add", (p) => {
          if (p.endsWith(".mp4") && p.includes(path.join(resultsDir, "chunks"))) {
            try {
              const rel = path.relative(resultsDir, p);
              send("chunkCreated", {
                video: path.basename(path.dirname(p)),
                relPath: rel,
              });
            } catch (e: any) {
              send("error", { scope: "watcher", message: e?.message || String(e) });
            }
          }
          enqueue(p);
        })
        .on("change", (p) => enqueue(p))
        .on("error", (err) => send("error", { scope: "watcher", message: String(err) }));

      const keepAlive = setInterval(() => {
        controller.enqueue(new TextEncoder().encode(": keep-alive\n\n"));
      }, 15000);

      const close = () => {
        clearInterval(keepAlive);
        watcher.close().catch(() => {});
        try { controller.close(); } catch {}
      };

      // @ts-ignore - not typed on NextRequest
      req.signal?.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}


