#!/bin/bash
# push.sh — quick Git commit and push helper
# Usage: ./push.sh "your commit message"
# If no message provided, uses a timestamped default

MESSAGE=${1:-"update $(date '+%Y-%m-%d %H:%M')"}

git add .
git commit -m "$MESSAGE"
git push

echo ""
echo "✅ Pushed to GitHub: $MESSAGE"
echo "   On your test server, run: git pull && docker compose up -d --build"
