from __future__ import annotations
import subprocess
from pathlib import Path
from typing import List, Dict
from ..utils import ensure_dir


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
        "-map",
        "0",
        "-c",
        "copy",
        "-f",
        "segment",
        "-segment_time",
        str(seconds),
        "-reset_timestamps",
        "1",
        str(pattern),
    ]
    subprocess.run(cmd, check=True)

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



