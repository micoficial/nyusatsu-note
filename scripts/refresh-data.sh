#!/usr/bin/env bash
# 予備の手順：GitHub Actions から国のサイトに届かなくなったとき、日本の回線（このPC）で取って控えを差し替え、作り直しを始める
# 使い方: GH_TOKEN=<micoficial に書き込めるトークン> bash scripts/refresh-data.sh   （KKJ_DAYS=30 などで日数を変えられる）
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="micoficial/nyusatsu-note"
RESTORE=1 UPLOAD=1 node scripts/fetch.mjs
gh workflow run deploy.yml -R "$REPO" --ref main
echo "控えを更新し、作り直しを始めました"
