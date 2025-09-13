from __future__ import annotations


# vlm (vision prompts)
VLM_FRAME_JSON = (
    "Return STRICT JSON only. Analyze a single frame and populate the schema below."
    "\nSchema: {"
    "  \"people_count\": int,"
    "  \"people\": [{\"upper_clothing_color\": string?, \"lower_clothing_color\": string?, \"accessories\": [string]?}]?,"
    "  \"vehicles\": [{\"type\": \"car|truck|van|bike|other\", \"color\": string?, \"direction\": string?}] ,"
    "  \"actions\": [string],  # Use a compact vocabulary: walking, running, standing, entering, exiting, carrying, interacting"
    "  \"movement\": {\"direction\": string, \"speed_hint\": \"slow|moderate|fast|unknown\"},"
    "  \"notable\": [string],  # Bright flashes, muzzle-like flash, crowds, obstacles, police lights, etc."
    "  \"quality\": {\"lighting\": \"bright|dim|night|mixed\", \"occlusion\": boolean, \"motion_blur\": \"low|med|high\"},"
    "  \"confidence\": {\"overall\": float, \"people\": float, \"vehicles\": float, \"movement\": float}"
    "}"
)

VLM_BATCH_JSON = (
    "Return STRICT JSON only. Analyze multiple images from the same short time window and produce a consolidated view."
    "\nAggregate across frames, de-duplicate observations, and indicate dominant trends."
    "\nSchema: {"
    "  \"entities\": {\"people_count\": int, \"vehicles_summary\": [{\"type\": string, \"color\": string?, \"approx_count\": int}]},"
    "  \"actions_summary\": [string],"
    "  \"movement\": {\"dominant_direction\": string, \"speed_hint\": \"slow|moderate|fast|unknown\", \"direction_changes\": boolean},"
    "  \"temporal_order\": [string],  # 1-4 short steps, e.g., 'subject exits building', 'moves east', 'enters vehicle'"
    "  \"notable\": [string],"
    "  \"quality\": {\"lighting\": \"bright|dim|night|mixed\", \"occlusion\": boolean, \"motion_blur\": \"low|med|high\"},"
    "  \"confidence\": {\"overall\": float, \"entities\": float, \"movement\": float}"
    "}"
)


# llm (text prompts)
CLIP_SYNOPSIS = (
    "Write a 2–3 sentence, neutral, dispatch-style summary of this clip."
    " Focus on who/what/where and direction of travel. Include counts (people/vehicles) and any clear identifiers"
    " (e.g., clothing color) only if unambiguous. Avoid speculation; use observed facts."
)

VIDEO_NARRATIVE = (
    "Produce 5 concise bullet points summarizing the entire video across all chunks."
    "\n- Scene overview (location cues, time-of-day cues)."
    "\n- Subject path with rough time ranges and directions (e.g., 0–30s eastbound, 30–50s stationary)."
    "\n- Interactions with vehicles or other people (counts, colors/types if clear)."
    "\n- Notable moments and potential forensic opportunities (entry/exit points, handled objects, surfaces)."
    "\n- Uncertainties and assumptions (call out low visibility, occlusion, or ambiguous moments)."
)



