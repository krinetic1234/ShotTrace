# footage_analysis — video processing mvp

## overview
processes long mp4 videos into structured json summaries with:
- yolo12 detections (people, vehicles, weapons)
- vision llm analysis (anthropic claude)
- simple iou-based tracking
- per-chunk and per-video summaries

## quickstart
Run `PYTHONPATH=.. uv run python -m footage_analysis.main --job_name kirk --jobs 8` from this folder

outputs land in `./artifacts/` as chunk files and json summaries.

## structure
```
footage_analysis/
├─ main.py              # entry point
├─ pipeline.py          # main processing pipeline
├─ schemas.py           # pydantic data models
├─ chunker.py           # ffmpeg video chunking
├─ detector.py          # yolo12 object detection
├─ tracker.py           # iou-based tracking
├─ apis.py              # anthropic + cerebras apis
├─ utils.py             # utility functions
├─ io_utils.py          # json i/o helpers
├─ config.yaml          # configuration
├─ requirements.txt     # python dependencies
└─ .env.example         # environment template
```

## configuration
edit `config.yaml` to tune:
- `chunk_seconds`: video chunk length (default 300s = 5min)
- `frame_stride`: analyze every nth frame (default 5)
- `vlm_every_n_frames`: vision llm cadence (default 30)
- `yolo_weights`: model path (default "yolo12n.pt")
- `target_classes`: detection classes

## api keys
set in `.env`:
- `ANTHROPIC_API_KEY`: for vision analysis
- `CEREBRAS_API_KEY`: for text synthesis (optional)

## notes
- chunking uses ffmpeg segment muxer with `-reset_timestamps 1`
- yolo12 models from ultralytics; swap weights as needed
- vision llm uses anthropic messages api with base64 images
- gun detection requires custom trained model (not in coco)
- set `vlm_every_n_frames` high for cost control on long videos

## references
- [ffmpeg segment muxer](https://ffmpeg.org/ffmpeg-formats.html#segment_002c-stream_005fsegment_002c-ssegment)
- [ultralytics yolo](https://docs.ultralytics.com/)
- [anthropic vision api](https://docs.anthropic.com/en/docs/build-with-claude/vision)
- [cerebras inference api](https://inference-docs.cerebras.ai/)
