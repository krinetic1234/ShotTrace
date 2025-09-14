export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const job = url.searchParams.get("job") || "kirk";
  const rel = url.searchParams.get("path");
  if (!rel) return new Response("missing path", { status: 400 });
  const scope = (url.searchParams.get("scope") || "results").toLowerCase();

  const baseResults = process.env.RESULTS_BASE_DIR || path.resolve(process.cwd(), "../footage_analysis/data/results");
  const baseVideos = process.env.VIDEOS_BASE_DIR || path.resolve(process.cwd(), "../footage_analysis/data/videos");
  const chosenBase = scope === "videos" ? baseVideos : baseResults;
  const abs = path.resolve(path.join(chosenBase, job, rel));

  // prevent path escape
  if (!abs.startsWith(path.resolve(path.join(chosenBase, job)))) {
    return new Response("forbidden", { status: 403 });
  }

  if (!fs.existsSync(abs)) return new Response("not found", { status: 404 });

  const stat = fs.statSync(abs);
  if (stat.isDirectory()) return new Response("is directory", { status: 400 });

  const ext = path.extname(abs).toLowerCase();
  const isVideo = ext === ".mp4";
  const type = isVideo ? "video/mp4" : ext === ".json" ? "application/json" : "application/octet-stream";

  // support HTTP Range for video streaming
  const range = req.headers.get("range");
  if (isVideo && range) {
    const fileSize = stat.size;
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0] || "0", 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (isNaN(start) || isNaN(end) || start > end || end >= fileSize) {
      return new Response("invalid range", { status: 416 });
    }

    const chunkSize = end - start + 1;
    const nodeStream = fs.createReadStream(abs, { start, end });
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        nodeStream.on("data", (chunk) => {
          const buf: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          const view = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
          controller.enqueue(view);
        });
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        try { nodeStream.close(); } catch {}
      },
    });
    return new Response(readable, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // non-range (or non-video) response
  if (isVideo) {
    const fileSize = stat.size;
    const nodeStream = fs.createReadStream(abs);
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        nodeStream.on("data", (chunk) => {
          const buf: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          const view = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
          controller.enqueue(view);
        });
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        try { nodeStream.close(); } catch {}
      },
    });
    return new Response(readable, {
      headers: {
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Content-Length": String(fileSize),
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const buf = fs.readFileSync(abs);
  return new Response(buf, { headers: { "Content-Type": type, "Content-Length": String(buf.length) } });
}


