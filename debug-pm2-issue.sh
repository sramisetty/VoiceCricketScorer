#!/bin/bash

# Debug PM2 Issue for Cricket Scorer
# Quick diagnostic and restart script

echo "=== PM2 Debug for Cricket Scorer ==="
echo ""

echo "1. Current PM2 Status:"
sudo -u cricketapp pm2 status
echo ""

echo "2. PM2 Logs (last 20 lines):"
sudo -u cricketapp pm2 logs cricket-scorer --lines 20
echo ""

echo "3. Application Directory Check:"
ls -la /opt/cricket-scorer/ 2>/dev/null || echo "Directory not found"
echo ""

echo "4. Built Application Check:"
ls -la /opt/cricket-scorer/dist/ 2>/dev/null || echo "Dist directory not found"
echo ""

echo "5. Environment Variables:"
sudo -u cricketapp pm2 show cricket-scorer | grep -A 10 "env:"
echo ""

echo "6. Quick Restart with Environment:"
sudo -u cricketapp pm2 restart cricket-scorer
echo ""

echo "7. Wait and Check Ports:"
sleep 5
netstat -tlnp | grep :5000 || echo "Port 5000 still not listening"
echo ""

echo "=== Debug Complete ==="