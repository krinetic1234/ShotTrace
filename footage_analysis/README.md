Our footage analysis pipeline turns a directory of incident videos into structured reports.

Data layout:
- Inputs: `data/videos/<job_name>/processed/*.mp4`
- Outputs: `data/results/<job_name>/`
  - `chunks/<video_stem>/...` (10s segments)
  - `summaries/<video_stem>/video_summary.json`, `clip_*.json`

Configure (`footage_analysis/config.yaml`):
```yaml
videos_base_dir: data/videos
results_base_dir: data/results

chunk_seconds: 10
frame_stride: 5
vlm_every_n_frames: 30
max_frames_per_chunk: 5000

yolo_weights: "yolo12n.pt"
target_classes: ["person", "car", "truck", "gun"]
conf_threshold: 0.25
track_iou_threshold: 0.4
track_max_age_frames: 45

enable_vlm: false
anthropic_model: "claude-sonnet-4-20250514"
vlm_interval_seconds: 10
vlm_images_per_call: 4
```

Run:
```bash
cd footage_analysis
uv run python main.py --job_name kirk --jobs 8
```

What happens:
1) CLI resolves input/output from YAML and `--job_name`, loads `.env` (API keys)
2) Videos are processed in parallel (`--jobs`)
3) For each video:
   - Chunk into 10s segments (ffmpeg, robust mapping)
   - For each chunk:
     - Decode frames (OpenCV), sample by `frame_stride`
     - Run YOLO detections for `target_classes`
     - Track IDs with `SimpleTracker` (IoU-based)
     - If `enable_vlm`: every `vlm_interval_seconds`, batch up to `vlm_images_per_call` frames and call Anthropic VLM with strict JSON prompts (`utils/prompts.py`); attach result as `vlm_json`
     - Generate a brief clip synopsis via text LLM
   - After chunks: write `video_summary.json` with combined timeline and narrative

Prompts are centralized in `utils/prompts.py`.
