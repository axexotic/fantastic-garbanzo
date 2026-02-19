#!/bin/bash
set -e

cd /home/ubuntu/fantastic-garbanzo

echo "Cleaning disk..."
rm -rf /tmp/* ~/.npm /var/cache/apt/*
docker volume prune -f

echo "Pulling latest code..."
git pull origin main

echo "Building frontend (using cache)..."
docker-compose -f docker-compose.prod.yml build frontend || {
  echo "Build failed, checking existing image..."
  docker ps -a
  exit 1
}

echo "Starting all services..."
docker-compose -f docker-compose.prod.yml up -d

sleep 5
echo "Container status:"
docker ps --format "table {{.Names}}\t{{.Status}}"

echo "✅ Done! Frontend deployed."
