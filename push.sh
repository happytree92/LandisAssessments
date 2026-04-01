#!/bin/bash
# push.sh — commit to GitHub + build and push multi-platform Docker image to GHCR
# Usage: ./push.sh "your commit message"
# If no message provided, uses a timestamped default

MESSAGE=${1:-"update $(date '+%Y-%m-%d %H:%M')"}

# Push code to GitHub
git add .
git commit -m "$MESSAGE"
git push

# Build and push multi-platform Docker image to GHCR
# Builds for both linux/amd64 (NAS/servers) and linux/arm64 (Apple Silicon)
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/happytree92/landisassessments:latest \
  --push .

echo ""
echo "✅ Code pushed to GitHub: $MESSAGE"
echo "✅ Image pushed to GHCR (amd64 + arm64)"
echo "   In Portainer, click 'Pull and redeploy' to get the latest image"
