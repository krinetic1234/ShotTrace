#!/bin/bash

curl -sS -X POST \
  -H 'Content-Type: text/plain' \
  -A 'ShotTrace/1.0 (contact: you@example.com)' \
  --data-binary @- \
  https://overpass-api.de/api/interpreter \
  -o buildings.json <<'EOF'
[out:json][timeout:25];
(
  node["building"](around:500,42.34999542085064,-71.07969549659289);
  way["building"](around:500,42.34999542085064,-71.07969549659289);
  relation["building"](around:500,42.34999542085064,-71.07969549659289);
);
out center tags;
EOF
