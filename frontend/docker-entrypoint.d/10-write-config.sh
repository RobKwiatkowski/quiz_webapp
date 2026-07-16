#!/bin/sh
set -eu

cat > /usr/share/nginx/html/js/config.js <<EOF
const CONFIG = {
  API_BASE_URL: "${API_BASE_URL:-/quiz-api}",
  LLM_API_BASE_URL: "${LLM_API_BASE_URL:-http://localhost:8000}"
};
EOF

