#!/bin/bash

# =============================================================================
# SERVER FIX SCRIPT - Run this ON THE SERVER
# =============================================================================
# 
# This script completely cleans and redeploys the application.
# Run this in /var/www/html/trading/ on your server.
#
# =============================================================================

set -e

echo "=========================================="
echo "  SERVER FIX - Complete Clean Deployment"
echo "=========================================="
echo ""

# Check we're in the right directory
if [ ! -f "package.json" ]; then
    echo "ERROR: package.json not found!"
    echo "Make sure you're in /var/www/html/trading/"
    exit 1
fi

echo "Step 1: Pulling latest code..."
git fetch origin
git reset --hard origin/main

echo ""
echo "Step 2: Installing dependencies..."
npm install

echo ""
echo "Step 3: Building application..."
npm run build

echo ""
echo "Step 4: Removing old files from web root..."
# Remove old assets, js, css folders and index.html
rm -rf assets/ js/ css/ 2>/dev/null || true
rm -f index.html .htaccess vite.svg 2>/dev/null || true

echo ""
echo "Step 5: Copying fresh dist/ contents to web root..."
cp -r dist/* .
cp dist/.htaccess .

echo ""
echo "Step 6: Setting permissions..."
sudo chown -R www-data:www-data .
find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;

echo ""
echo "Step 7: Verifying deployment..."
echo "Checking index.html..."
if grep -q "assets/index-" index.html; then
    echo "✅ index.html references compiled JS"
else
    echo "❌ ERROR: index.html doesn't reference compiled JS!"
    exit 1
fi

echo ""
echo "Checking assets folder..."
ls -la assets/

echo ""
echo "=========================================="
echo "  ✅ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "Clear your browser cache and reload:"
echo "  - Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)"
echo "  - Or use Incognito/Private mode"
echo ""

