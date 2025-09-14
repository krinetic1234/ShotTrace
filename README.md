# ShotTrace: Real-Time Gunshot Detection & Response System

ShotTrace is an advanced emergency response system designed to minimize Time-to-Capture (TTC) from the moment a gunshot occurs to the moment the suspect is detained. The system transforms raw signals (audio, calls, video) into actionable guidance for first responders through AI-powered signal processing, intelligent footage triage, and real-time analysis.

## 🎯 Mission

**Critical Assumption**: TTC is non-linear - the odds of capturing a suspect drop exponentially after ~20 minutes. ShotTrace addresses this by providing high-fidelity localization and intelligent footage triage to narrow the responder search space.

## 🏗️ System Architecture

### High-Level Flow

1. **Signal Processing & Localization**
   - Process audio signals from multiple microphones (minimum 3 required)
   - Calculate time-difference-of-arrival (TDOA) to pinpoint gunshot coordinates
   - Provide precise location data to narrow search space

2. **Intelligent Footage Triage**
   - AI agents/LLMs analyze the incident location
   - Identify nearby surveillance sources (buildings, homes, businesses)
   - Automatically contact property owners or dispatch units to obtain footage
   - Prioritize footage based on proximity and quality

3. **Parallel Video Analysis**
   - Deploy video models to analyze collected footage simultaneously
   - Generate actionable insights for police:
     - **Suspect Identity**: Rough physical description and characteristics
     - **Direction of Travel**: Where the suspect is headed
     - **Forensic Opportunities**: Compromised areas for evidence collection (shoe prints, fingerprints, etc.)

## 📁 Project Structure

```
ShotTrace/
├── README.md                           # This file - project overview and documentation
├── .gitignore                          # Git ignore rules (excludes .env and other sensitive files)
├── .env                                # Environment variables (not tracked in git)
│
├── footage_analysis/                   # Video processing and AI analysis module
│   ├── models/                         # ML models for video analysis
│   ├── processors/                     # Video processing algorithms
│   └── analyzers/                      # AI-powered content analysis
│
├── footage_collection/                 # Footage acquisition and management
│   ├── sources/                        # Different footage source integrations
│   ├── contacts/                       # Property owner contact management
│   └── dispatch/                       # Police unit coordination
│
├── gunshot_triangulation/              # Core audio processing and localization
│   ├── signal_processing/              # Audio signal analysis algorithms
│   ├── triangulation/                  # TDOA calculation and coordinate mapping
│   └── calibration/                    # Microphone array calibration
│
└── shotrace/                          # Next.js web application
    ├── app/                           # Next.js 15 app directory
    │   ├── layout.tsx                 # Root layout component
    │   ├── page.tsx                   # Main dashboard page
    │   └── globals.css                # Global styles with Tailwind CSS
    ├── public/                        # Static assets
    ├── package.json                   # Dependencies and scripts
    ├── next.config.ts                 # Next.js configuration
    ├── tsconfig.json                  # TypeScript configuration
    └── postcss.config.mjs             # PostCSS configuration for Tailwind
```

## 🎥 Footage Analysis Pipeline (Python)

The pipeline in `footage_analysis/` turns a directory of incident videos into structured summaries.

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