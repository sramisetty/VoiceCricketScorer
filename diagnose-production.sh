#!/bin/bash

# Simple diagnostic script for production server issues

echo "=== Cricket Scorer Production Diagnostics ==="

# Test the main site
echo "1. Testing main site response:"
curl -I https://score.ramisetty.net/

echo -e "\n2. Testing specific asset file:"
curl -I https://score.ramisetty.net/assets/index-CPbDgN6S.js

echo -e "\n3. Testing if server responds to port 3000:"
curl -I http://67.227.251.94:3000/ || echo "Port 3000 not accessible"

echo -e "\n4. Checking if site returns HTML content:"
curl -s https://score.ramisetty.net/ | head -20

echo -e "\n=== Key Issues Identified ==="
echo "- Static assets returning 404 (JavaScript/CSS files not served)"
echo "- React app shell loads but JavaScript doesn't execute"
echo "- Build process completes but static file serving fails"

echo -e "\n=== Recommended Actions ==="
echo "1. Run fix-production-static-files.sh to address static serving"
echo "2. Verify PM2 process is running from correct working directory" 
echo "3. Check Nginx configuration for static file routing"
echo "4. Ensure dist/public directory has proper permissions"