#!/bin/sh
set -eu

cat > /usr/share/nginx/html/js/config.js <<EOF
const CONFIG = {
  API_BASE_URL: "${API_BASE_URL:-}"
};
EOF
