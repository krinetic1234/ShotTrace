from __future__ import annotations
import json
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional


def _det_counts(frames: List[Any]) -> Dict[str, int]:
    cnt = Counter()
    for fr in frames:
        for d in getattr(fr, "detections", []) or []:
            cls_ = getattr(d, "cls", None)
            if cls_:
                cnt[cls_] += 1
    return dict(cnt)


def _collect_vlm_fields(frames: List[Any], max_items: int = 3) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    surfaces = Counter()
    entries: List[str] = []
    notables = Counter()
    actions = Counter()
    touch_events: List[Dict[str, Any]] = []
    routes = Counter()
    for fr in frames:
        v = getattr(fr, "vlm_json", None)
        if not v:
            continue
        if isinstance(v, dict):
            # batch schema preferred
            surf = v.get("surface_level")
            if surf:
                surfaces[surf] += 1
            for e in v.get("entry_exit_points", []) or []:
                entries.append(str(e))
            for a in v.get("actions_summary", []) or v.get("actions", []) or []:
                actions[str(a)] += 1
            for n in v.get("notable", []) or []:
                notables[str(n)] += 1
            for t in v.get("touch_events", []) or []:
                touch_events.append(t)
            for r in v.get("escape_routes", []) or []:
                routes[str(r)] += 1
    out["surface_level_modes"] = [k for k, _ in surfaces.most_common(3)]
    out["entry_exit_points"] = list(dict.fromkeys(entries))[:5]
    out["common_actions"] = [k for k, _ in actions.most_common(5)]
    out["common_notable"] = [k for k, _ in notables.most_common(5)]
    out["touch_events_samples"] = touch_events[:max_items]
    out["escape_routes_modes"] = [k for k, _ in routes.most_common(3)]
    return out


def build_clip_context(frames: List[Any], seconds: Optional[float] = None) -> Dict[str, Any]:
    """Compact JSON context for a single clip from its frames.
    Focuses on YOLO detections (especially persons), includes a few VLM fields,
    and a short recent timeline sample.
    """
    ctx: Dict[str, Any] = {}
    # overall class counts
    det_counts = _det_counts(frames)
    ctx["det_counts"] = det_counts

    # person-focused tracking summary
    # collect track trajectories for persons across frames
    track_traj: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for fr in frames:
        ms = getattr(fr, "ms_from_chunk_start", None)
        for d in getattr(fr, "detections", []) or []:
            if getattr(d, "cls", None) == "person" and getattr(d, "track_id", None) is not None:
                x1, y1, x2, y2 = (d.bbox_xyxy if hasattr(d, "bbox_xyxy") else [None, None, None, None])
                if x1 is None:
                    continue
                cx = (x1 + x2) / 2.0
                cy = (y1 + y2) / 2.0
                track_traj[int(d.track_id)].append({"ms": ms, "cx": cx, "cy": cy, "conf": getattr(d, "conf", None)})

    def _cardinal(dx: float, dy: float) -> str:
        if dx is None or dy is None:
            return "unknown"
        import math
        ang = (math.degrees(math.atan2(-dy, dx)) + 360.0) % 360.0  # 0=east, 90=north
        dirs = [(0, "east"), (45, "northeast"), (90, "north"), (135, "northwest"), (180, "west"), (225, "southwest"), (270, "south"), (315, "southeast"), (360, "east")]
        best = min(dirs, key=lambda t: abs(ang - t[0]))
        return best[1]

    persons_summary: List[Dict[str, Any]] = []
    for tid, pts in track_traj.items():
        pts_sorted = sorted([p for p in pts if p.get("ms") is not None], key=lambda x: x["ms"]) or pts
        if not pts_sorted:
            continue
        first, last = pts_sorted[0], pts_sorted[-1]
        dt = max(1, (last.get("ms") or 0) - (first.get("ms") or 0))  # ms
        dx = (last.get("cx") or 0) - (first.get("cx") or 0)
        dy = (last.get("cy") or 0) - (first.get("cy") or 0)
        direction = _cardinal(dx, dy)
        speed_px_per_s = ((dx ** 2 + dy ** 2) ** 0.5) / (dt / 1000.0)
        if speed_px_per_s < 10:
            speed_hint = "slow"
        elif speed_px_per_s < 50:
            speed_hint = "moderate"
        else:
            speed_hint = "fast"
        persons_summary.append({
            "track_id": tid,
            "observations": len(pts_sorted),
            "duration_ms": dt,
            "direction": direction,
            "speed_hint": speed_hint,
            "last_conf": last.get("conf")
        })

    ctx["persons_active_count"] = len(persons_summary)
    # prioritize longest-observed persons
    persons_summary = sorted(persons_summary, key=lambda p: (-p["observations"], -p["duration_ms"]))
    ctx["persons_summary"] = persons_summary[:5]

    # vehicles overview
    vehicle_classes = [k for k in det_counts.keys() if k in {"car", "truck", "van", "bike"}]
    ctx["vehicles_present"] = {k: det_counts.get(k, 0) for k in vehicle_classes}

    # summarized VLM fields
    ctx["vlm"] = _collect_vlm_fields(frames)
    # short timeline sample: last 5 frames with tracked detections
    recent = []
    for fr in frames[-10:]:
        dets = []
        for d in getattr(fr, "detections", []) or []:
            dets.append({
                "cls": getattr(d, "cls", None),
                "conf": getattr(d, "conf", None),
                "track_id": getattr(d, "track_id", None),
            })
        recent.append({
            "ms": getattr(fr, "ms_from_chunk_start", None),
            "detections": dets,
        })
    ctx["recent_timeline"] = recent
    if seconds is not None:
        ctx["clip_seconds"] = seconds
    return ctx


def build_video_context(clip_summaries: List[Any], timeline: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compact context for an entire video: class counts, recent timeline and a sample of VLM fields from clips."""
    det_cnt = Counter()
    for clip in clip_summaries:
        for fr in getattr(clip, "frames", []) or []:
            for d in getattr(fr, "detections", []) or []:
                if getattr(d, "cls", None):
                    det_cnt[getattr(d, "cls")] += 1
    # sample vlm across clips
    all_frames = []
    for clip in clip_summaries:
        all_frames.extend(getattr(clip, "frames", []) or [])
    vlm_fields = _collect_vlm_fields(all_frames)
    # recent timeline tail
    tail = timeline[-20:] if timeline else []
    return {
        "det_counts": dict(det_cnt),
        "vlm": vlm_fields,
        "recent_timeline": tail,
    }


def build_job_context_from_paths(summary_paths: List[str], max_per_video: int = 20, synopses_tail_n: int = 5) -> Dict[str, Any]:
    """Aggregate lightweight context across videos for the job_report.
    Loads each video_summary.json and extracts det counts, tail timeline, and any surface/touch/escape hints.
    """
    videos: List[Dict[str, Any]] = []
    totals = Counter()
    routes = Counter()
    surfaces = Counter()
    for p in summary_paths:
        try:
            with open(p, "r") as f:
                vs = json.load(f)
        except Exception:
            continue
        # counts
        v_cnt = Counter()
        all_frames = []
        synopses: List[str] = []
        for clip in vs.get("clip_summaries", []) or []:
            for fr in clip.get("frames", []) or []:
                all_frames.append(fr)
                for d in (fr.get("detections", []) or []):
                    c = d.get("cls")
                    if c:
                        v_cnt[c] += 1
                        totals[c] += 1
            syn = clip.get("synopsis")
            if syn:
                synopses.append(str(syn))
        vlm_fields = _collect_vlm_fields(all_frames)
        for r in vlm_fields.get("escape_routes_modes", []) or []:
            routes[r] += 1
        for s in vlm_fields.get("surface_level_modes", []) or []:
            surfaces[s] += 1
        videos.append({
            "video": vs.get("video_path", p),
            "det_counts": dict(v_cnt),
            "vlm": vlm_fields,
            "timeline_tail": (vs.get("combined_timeline", []) or [])[-max_per_video:],
            "synopses_tail": synopses[-synopses_tail_n:],
        })
    return {
        "totals": dict(totals),
        "escape_routes_modes": [k for k, _ in routes.most_common(5)],
        "surface_level_modes": [k for k, _ in surfaces.most_common(5)],
        "videos": videos,
    }


