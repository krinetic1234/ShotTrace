export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const job = new URL(req.url).searchParams.get("job") || "kirk";
  const videosBase = process.env.VIDEOS_BASE_DIR || path.resolve(process.cwd(), "../footage_analysis/data/videos");
  const jobDir = path.join(videosBase, job);
  const processedDir = path.join(jobDir, "processed");
  const rawDir = path.join(jobDir, "raw");
  const res = {
    job,
    processed: fs.existsSync(processedDir) ? fs.readdirSync(processedDir).filter(f => f.endsWith(".mp4")).sort() : [],
    raw: fs.existsSync(rawDir) ? fs.readdirSync(rawDir).filter(f => f.endsWith(".mp4")).sort() : [],
  };
  return Response.json(res);
}


