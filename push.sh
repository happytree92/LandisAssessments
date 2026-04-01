#!/bin/bash
# push.sh — commit to GitHub + build and push Docker image to GHCR
# Usage: ./push.sh "your commit message"
# If no message provided, uses a timestamped default
#
# Builds linux/amd64 only. better-sqlite3 is a native C++ module that must be
# compiled natively — QEMU cross-compilation for arm64 produces broken binaries.
# amd64 runs natively on Intel/AMD NAS hardware and via emulation on arm64 NAS.

MESSAGE=${1:-"update $(date '+%Y-%m-%d %H:%M')"}

# Push code to GitHub
git add .
git commit -m "$MESSAGE"
git push

# Build and push amd64 Docker image to GHCR
docker buildx build --platform linux/amd64 --no-cache \
  -t ghcr.io/happytree92/landisassessments:latest \
  --push .

echo ""
echo "✅ Code pushed to GitHub: $MESSAGE"
echo "✅ Image pushed to GHCR (amd64)"
echo "   In Portainer, click 'Pull and redeploy' to get the latest image"
