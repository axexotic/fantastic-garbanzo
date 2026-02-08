#!/usr/bin/env bash
# ============================================
# VoiceTranslate — Dev Setup Script
# ============================================
set -e

echo "🚀 Setting up VoiceTranslate development environment..."

# ---- 1. Environment file ----
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env from .env.example — fill in your API keys"
else
  echo "✅ .env already exists"
fi

# ---- 2. Docker (Postgres + Redis) ----
echo "🐳 Starting Docker containers (PostgreSQL + Redis)..."
docker compose up -d

# Wait for services
echo "⏳ Waiting for services..."
sleep 3

# ---- 3. Backend ----
echo "🐍 Setting up Python backend..."
cd backend

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -e ".[dev]" --quiet

echo "✅ Backend dependencies installed"
cd ..

# ---- 4. Frontend ----
echo "⚛️  Setting up Next.js frontend..."
cd frontend
npm install --silent
cd ..

echo ""
echo "============================================"
echo "  ✅ Setup complete!"
echo "============================================"
echo ""
echo "  To start developing:"
echo ""
echo "  Backend:   cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo "  Frontend:  cd frontend && npm run dev"
echo ""
echo "  Services:  PostgreSQL on :5432, Redis on :6379"
echo ""
echo "  ⚠️  Don't forget to add your API keys to .env:"
echo "     - DEEPGRAM_API_KEY"
echo "     - ELEVENLABS_API_KEY"
echo "     - OPENAI_API_KEY"
echo "     - DAILY_API_KEY"
echo "============================================"
