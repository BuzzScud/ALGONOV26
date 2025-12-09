#!/bin/bash

# =============================================================================
# DEPLOYMENT SCRIPT FOR VOYNICH.ONLINE/TRADING/
# =============================================================================
# 
# This script helps deploy the compiled application to the server.
# It ensures ONLY the compiled files from dist/ are uploaded, NOT source files.
#
# IMPORTANT: Run this AFTER building the application with: npm run build
#
# Usage:
#   ./deploy.sh                    # Deploy to default server
#   ./deploy.sh user@server:/path  # Deploy to custom location
#
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default deployment target (change this to your server)
DEFAULT_TARGET="buzzscud@voynich.online:/var/www/html/trading/"

# Use provided target or default
TARGET="${1:-$DEFAULT_TARGET}"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  DEPLOYMENT SCRIPT - ALGO-1 Platform  ${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Check if dist/ folder exists
if [ ! -d "dist" ]; then
    echo -e "${RED}ERROR: dist/ folder not found!${NC}"
    echo -e "Please build the application first with: ${GREEN}npm run build${NC}"
    exit 1
fi

# Check if dist/index.html references compiled JS (not source JSX)
if grep -q "src/main.jsx" dist/index.html 2>/dev/null; then
    echo -e "${RED}ERROR: dist/index.html contains source file reference!${NC}"
    echo -e "The build may have failed. Please run: ${GREEN}npm run build${NC}"
    exit 1
fi

# Verify compiled JS exists
JS_FILE=$(ls dist/js/index-*.js 2>/dev/null | head -1)
if [ -z "$JS_FILE" ]; then
    echo -e "${RED}ERROR: Compiled JavaScript not found in dist/js/!${NC}"
    echo -e "Please rebuild with: ${GREEN}npm run build${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build verification passed${NC}"
echo -e "  Found compiled JS: ${JS_FILE}"
echo ""

# Show what will be deployed
echo -e "${YELLOW}Files to deploy:${NC}"
echo "  dist/"
ls -la dist/
echo ""
echo "  dist/js/"
ls -la dist/js/
echo ""

# Confirm deployment
echo -e "${YELLOW}Deploy to: ${TARGET}${NC}"
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Deploy using rsync (preserves permissions, only transfers changes)
echo -e "${YELLOW}Deploying...${NC}"

# Method 1: Using rsync (preferred)
if command -v rsync &> /dev/null; then
    rsync -avz --delete \
        --exclude='.DS_Store' \
        --exclude='*.map' \
        dist/ "${TARGET}"
    
    echo -e "${GREEN}✓ Deployment complete using rsync${NC}"
else
    # Method 2: Using scp (fallback)
    echo "rsync not found, using scp..."
    scp -r dist/* "${TARGET}"
    scp dist/.htaccess "${TARGET}"
    
    echo -e "${GREEN}✓ Deployment complete using scp${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  DEPLOYMENT SUCCESSFUL!               ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Next steps on the server:"
echo -e "  1. Set permissions: ${YELLOW}sudo chown -R www-data:www-data /var/www/html/trading/${NC}"
echo -e "  2. Verify: ${YELLOW}curl -I https://voynich.online/trading/${NC}"
echo -e "  3. Clear browser cache and test"
echo ""

