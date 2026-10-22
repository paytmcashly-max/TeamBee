#!/usr/bin/env bash
set -e

echo "========================================================"
echo "🚀 TeamBee Automated Deployer to Render"
echo "========================================================"

cd "$(dirname "$0")"

echo "📌 1. Ensuring git changes & render.yaml are committed and pushed..."
git add render.yaml deploy_render.js deploy_to_render.sh 2>/dev/null || true
if git status --porcelain | grep -q .; then
    git commit -m "feat(deploy): configure Render Blueprint and automated deployment engine" || true
    echo "📤 Pushing latest commits to GitHub (origin/main)..."
    git push origin main || echo "⚠️ Push failed or already up to date, continuing to deploy..."
fi

echo ""
echo "📌 2. Running Render API deployment engine..."
node deploy_render.js

echo ""
echo "========================================================"
echo "✅ Completed! Check your Render dashboard at:"
echo "👉 https://dashboard.render.com"
echo "========================================================"
