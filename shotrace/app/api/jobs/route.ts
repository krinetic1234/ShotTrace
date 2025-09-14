export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(_req: NextRequest) {
  const base = process.env.RESULTS_BASE_DIR || path.resolve(process.cwd(), "../footage_analysis/data/results");
  if (!fs.existsSync(base)) return Response.json({ jobs: [] });
  const jobs = fs.readdirSync(base).filter((d) => {
    const p = path.join(base, d);
    return fs.statSync(p).isDirectory();
  }).sort();
  return Response.json({ jobs });
}


