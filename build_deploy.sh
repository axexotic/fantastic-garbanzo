#!/bin/bash
cd /home/ubuntu/fantastic-garbanzo
echo "Building frontend..."
docker-compose -f docker-compose.prod.yml build --no-cache frontend
if [ $? -eq 0 ]; then
  echo "Build successful. Starting containers..."
  docker-compose -f docker-compose.prod.yml up -d
  sleep 5
  docker ps --format "table {{.Names}}\t{{.Status}}"
  echo "✅ Deployment complete!"
else
  echo "❌ Build failed"
  exit 1
fi
