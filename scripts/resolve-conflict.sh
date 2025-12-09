#!/bin/bash
# Script to resolve Git merge conflicts on production server
# Run this on the server: bash resolve-conflict.sh

echo "🔍 Checking Git status..."
git status

echo ""
echo "📋 Listing conflicted files..."
git diff --name-only --diff-filter=U

echo ""
echo "🔄 Resolving conflicts by accepting remote version..."
echo "   (This will use the version from GitHub)"

# Accept remote version for all conflicted files
git checkout --theirs .
git add .

echo ""
echo "✅ Staging resolved files..."

echo ""
echo "💾 Committing resolved conflicts..."
git commit -m "Resolve merge conflicts - accept remote changes" || echo "No conflicts to commit or already committed"

echo ""
echo "📥 Pulling latest changes..."
git pull origin main

echo ""
echo "📤 Pushing to remote..."
git push origin main

echo ""
echo "✅ Done! Conflicts should be resolved."

