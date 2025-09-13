from __future__ import annotations
from pathlib import Path
import sys
import argparse
import yaml
from dotenv import load_dotenv
import logging

# load env early so api keys are available
here = Path(__file__).resolve().parent
load_dotenv(here / ".env")
load_dotenv(here.parent / ".env")

if __package__ is None or __package__ == "":
    sys.path.append(str(here))
    from pipeline.run import process_video  # type: ignore
else:
    from .pipeline.run import process_video


def main() -> None:
    cfg_path = here / "config.yaml"
    with open(cfg_path, "r") as f:
        cfg = yaml.safe_load(f)

    parser = argparse.ArgumentParser(description="run footage analysis pipeline over a directory of videos")
    base_videos = Path(cfg.get("videos_base_dir", "data/videos"))
    base_results = Path(cfg.get("results_base_dir", "data/results"))
    parser.add_argument("--job_name", default="kirk", help="job name; reads from data/videos/<job_name>/processed and writes to data/results/<job_name>")
    parser.add_argument("--jobs", type=int, default=1, help="number of videos to process in parallel")
    args = parser.parse_args()

    # compute io paths from yaml bases and job_name
    videos_dir = base_videos / args.job_name / "processed"
    artifacts_dir = base_results / args.job_name
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    cfg["artifacts_dir"] = str(artifacts_dir)

    # feature toggles (default true if not present)
    enable_vlm = bool(cfg.get("enable_vlm", True))
    enable_llm = bool(cfg.get("enable_llm", True))
    enable_yolo = True

    # basic logging banner
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.info(
        f"job={args.job_name} videos_dir={videos_dir} artifacts_dir={cfg['artifacts_dir']} "
        f"yolo={enable_yolo} vlm={enable_vlm} llm={enable_llm} chunk_seconds={cfg.get('chunk_seconds')}"
    )
    if not videos_dir.exists():
        raise FileNotFoundError(f"videos_dir not found: {videos_dir}")

    videos = sorted([p for p in videos_dir.glob("*.mp4") if p.is_file()])
    if not videos:
        raise SystemExit(f"no .mp4 files found in {videos_dir}")

    if args.jobs <= 1:
        for vp in videos:
            process_video(str(vp), cfg)
    else:
        from concurrent.futures import ThreadPoolExecutor, as_completed

        with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as ex:
            futs = {ex.submit(process_video, str(vp), cfg): vp for vp in videos}
            for fut in as_completed(futs):
                vp = futs[fut]
                try:
                    fut.result()
                except Exception as e:
                    print(f"error processing {vp}: {e}")


if __name__ == "__main__":
    main()
