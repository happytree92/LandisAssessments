#!/bin/bash
# push.sh — commit and push to GitHub
# GitHub Actions automatically builds and pushes the Docker image to GHCR
# on every push to main (see .github/workflows/docker.yml)
# Usage: ./push.sh "your commit message"

MESSAGE=${1:-"update $(date '+%Y-%m-%d %H:%M')"}

git add .
git commit -m "$MESSAGE"
git push

echo ""
echo "✅ Pushed to GitHub: $MESSAGE"
echo "   GitHub Actions is now building the Docker image on real x86_64 hardware."
echo "   Check progress at: https://github.com/happytree92/LandisAssessments/actions"
echo "   Once the build completes (~3 min), pull and redeploy in Portainer."
