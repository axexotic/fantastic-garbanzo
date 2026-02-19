#!/bin/bash
set -e

cd /home/ubuntu/fantastic-garbanzo

echo "✅ Pulling latest code..."
git pull origin main

echo "✅ Building frontend..."
docker-compose -f docker-compose.prod.yml build frontend

echo "✅ Starting all services..."
docker-compose -f docker-compose.prod.yml up -d

sleep 5

echo "✅ Container status:"
docker ps --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "✅ Batch 2 UI Deployment Complete!"
echo "Visit https://flaskai.xyz to see the new features:"
echo "  🔴 Recording (disc icon)"
echo "  ✏️ Whiteboard (pen tool)"
echo "  📊 Video Quality (chart icon)"
echo "  🔔 Notifications (bell icon)"
