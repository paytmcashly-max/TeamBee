#!/usr/bin/env bash
set -e

echo "========================================================"
echo "TeamBee Automated Deployer to Render"
echo "========================================================"

cd "$(dirname "$0")"

CURRENT_BRANCH="${RENDER_BRANCH:-$(git rev-parse --abbrev-ref HEAD || echo main)}"

echo "1. Pushing branch $CURRENT_BRANCH to GitHub..."
git push origin "$CURRENT_BRANCH"

echo ""
echo "2. Running Render API deployment engine..."
RENDER_BRANCH="$CURRENT_BRANCH" node deploy_render.js

echo ""
echo "Completed! Check https://dashboard.render.com"
