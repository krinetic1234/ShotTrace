from __future__ import annotations

# VLM: multi-frame (batch) JSON over a short window
VLM_BATCH_JSON = """
Return STRICT JSON only. Analyze multiple images from the same short time window and produce a consolidated view (no images will be sent to other models).
Aggregate across frames, de-duplicate observations, and indicate dominant trends.
{
  "entities": {"people_count": int, "vehicles_summary": [{"type": string, "color": string?, "approx_count": int}]},
  "actions_summary": [string],
  "movement": {"dominant_direction": string, "speed_hint": "slow|moderate|fast|unknown", "direction_changes": boolean},
  "surface_level": "ground|rooftop|stairs|balcony|unknown",
  "entry_exit_points": [string],
  "path_segments": [{"dir": string, "speed": "slow|moderate|fast|unknown"}]?,
  "pause_points": [{"location_hint": string?, "reason": "lookout|manipulate_object|obstruction|unknown"}]?,
  "touch_events": [
    {"surface": "roof|ground|ladder|railing|door_handle|window|fence|vehicle|other",
     "action": "touch|grab|lean|climb",
     "location_hint": string?}
  ]?,
  "weapon_likelihood": {"score": float, "indicators": [string]},
  "escape_routes": ["alley_east","stairwell_north","rooftop_gap","street_west","unknown"]?,
  "forensics_recommendations": [
    {"target": "door_handle|railing|ladder_rung|dumpster_lid|window_frame|vehicle_door|other",
     "location_hint": string?,
     "rationale": string}
  ]?,
  "notable": [string],
  "quality": {"lighting": "bright|dim|night|mixed", "occlusion": boolean, "motion_blur": "low|med|high"},
  "confidence": {"overall": float, "entities": float, "movement": float},
  "suspicion_score": float
}
"""

# LLM: Clip synopsis
CLIP_SYNOPSIS = """
You are given structured JSON context (detections, tracks, and any VLM batch JSON). No images are provided.
Write a 2–3 sentence, neutral, dispatch-style summary of this clip using only the provided context.
Prioritize: movement direction, surface level (ground/rooftop/stairs), pause/touch events (objects/surfaces), and any obvious escape route hints.
Include identifiers only when unambiguous; avoid speculation.
"""

# LLM: Per-video narrative bullets
VIDEO_NARRATIVE = """
Produce 5 concise bullet points summarizing the entire video across all chunks.
- Scene overview (location cues, time-of-day cues).
- Subject path with rough time ranges and directions (e.g., 0–30s eastbound, 30–50s stationary).
- Interactions with vehicles or other people (counts, colors/types if clear).
- Notable moments and potential forensic opportunities (entry/exit points, handled objects, surfaces).
- Uncertainties and assumptions (call out low visibility, occlusion, or ambiguous moments).
"""

# LLM: Job-level synthesis across all videos (final report)
JOB_SUMMARY_REPORT = """
You are given structured JSON context (per-video summaries with detections, timelines, and any VLM batch JSON). No images are provided.
Produce a single, concise, high-signal incident report for responders and command staff AFTER all video synthesis.
Treat any person performing suspicious actions as the likely subject (running, climbing, concealing, evading). Do not overfit identity details.
Cover:
1) Major Alerts — subject cues (distinct clothing/accessories), vehicle involvement, weapon/muzzle indicators.
2) Movement Overview — generalized heading and clear path segments, noting PAUSES and TOUCH events (objects/surfaces like door handles, railings, ladders, rooftop edges).
3) Forensics Capture — prioritized list of surfaces/objects to swab/print (handle/railing/ladder rung/window frame/vehicle door/etc.) with concise rationale and approximate locations.
4) Escape Hatches — likely exit corridors (alleys, stairwells, rooftop gaps) based on movement and entry/exit points.
5) Priority Actions (by TTC) — 3–6 actions for immediate containment/search.
Keep it factual and cautious; prefer clear observations over speculation.
Return a clear prose report; if you include any JSON, keep it short.
"""



