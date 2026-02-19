#!/bin/bash
set -e

cd /home/ubuntu/fantastic-garbanzo

echo "=== Cleaning Docker resources ==="
docker system prune -af --volumes 2>&1 | grep -E "Deleted|freed|Total"

echo ""
echo "=== Checking disk space ==="
df -h / | tail -1

echo ""
echo "=== Rebuilding frontend (may take 5-10 minutes) ==="
docker-compose -f docker-compose.prod.yml build --no-cache frontend

echo ""
echo "=== Starting all containers ==="
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "=== Waiting for services to start ==="
sleep 10

echo ""
echo "=== Verifying containers ==="
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

echo ""
echo "✅ Deployment complete!"
