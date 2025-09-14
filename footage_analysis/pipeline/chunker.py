from __future__ import annotations
import subprocess
from pathlib import Path
from typing import List, Dict
from ..utils import ensure_dir
import os


def chunk_video(video_path: str | Path, out_root: str | Path, seconds: int) -> List[Dict]:
    vp = Path(video_path)
    odir = ensure_dir(Path(out_root) / "chunks" / vp.stem)
    pattern = odir / f"{vp.stem}_%05d.mp4"

    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(vp),
        # map video/audio if present; don't fail if stream missing
        "-map",
        "0:v:0?",
        "-map",
        "0:a:0?",
        "-c:v",
        "copy",
        "-c:a",
        "copy",
        "-f",
        "segment",
        "-segment_time",
        str(seconds),
        "-reset_timestamps",
        "1",
        str(pattern),
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg segment failed for {vp.name}: {proc.stderr.strip()}")

    # transcode all generated chunks to web-safe H.264/AAC (in-place)
    scripts_dir = Path(__file__).resolve().parent.parent / "utils"
    transcode_script = scripts_dir / "transcode.sh"
    if transcode_script.exists():
        try:
            subprocess.run([
                "bash",
                str(transcode_script),
                str(odir),
            ], check=True)
        except subprocess.CalledProcessError as e:
            print(f"[chunker] transcode warning for {odir}: {e}")

    out = []
    for i, p in enumerate(sorted(odir.glob(f"{vp.stem}_*.mp4"))):
        out.append(
            {
                "chunk_path": str(p),
                "index": i,
                "start_sec": i * seconds,
                "end_sec": (i + 1) * seconds,
            }
        )
    return out



