#!/usr/bin/env bash
set -euo pipefail

folder="${1:-}"
if [[ -z "$folder" ]]; then
  echo "Usage: $0 <folder-with-mp4-files>" >&2
  exit 1
fi

if [[ ! -d "$folder" ]]; then
  echo "Folder not found: $folder" >&2
  exit 1
fi

find "$folder" -type f -name "*.mp4" -exec bash -c '
  F="$1"
  echo "Transcoding: $F"
  if ! ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$F" >/dev/null; then
    echo "Skipping (no video stream): $F"; echo; exit 0;
  fi
  tmp="${F%.mp4}.h264.tmp.mp4"
  if ffmpeg -y -hide_banner -loglevel error -i "$F" \
    -c:v libx264 -preset veryfast -crf 22 -profile:v high -level 4.1 -pix_fmt yuv420p \
    -c:a aac -b:a 128k -ac 2 -movflags +faststart \
    "$tmp"; then
    mv "$tmp" "$F"
  else
    echo "Failed: $F"; rm -f "$tmp"
  fi
  echo
' _ {} \;


