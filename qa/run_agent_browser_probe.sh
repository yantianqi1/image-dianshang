#!/usr/bin/env bash
set -euo pipefail

url="$1"
probe="$2"

agent-browser close --all >/dev/null 2>&1 || true
agent-browser open "$url" >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval --stdin < "$probe"
agent-browser close >/dev/null

