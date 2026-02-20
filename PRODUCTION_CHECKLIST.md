# Production Checklist for Real-Time Voice Translation

## 🔑 Required API Keys (`.env`)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/voicetranslate

# Redis (Upstash or Redis Cloud)
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379

# Speech-to-Text
DEEPGRAM_API_KEY=your_deepgram_api_key

# Translation (at least one)
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx  # Fallback

# Text-to-Speech & Voice Cloning
ELEVENLABS_API_KEY=your_elevenlabs_key

# WebRTC Calls
DAILY_API_KEY=your_daily_api_key

# Security
SECRET_KEY=generate-a-strong-random-key-here

# URLs
BACKEND_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

## 🔒 Security Hardening

### 1. Authentication
- [x] Use HTTP-only cookies instead of localStorage for tokens
- [x] Implement refresh token rotation
- [x] Add rate limiting (Redis-backed middleware + nginx)
- [x] Add CSRF protection (double-submit cookie)
- [x] Validate all user inputs (Pydantic Field validators)

### 2. API Security
```python
# Add to backend/app/main.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# Rate limit sensitive endpoints
@router.post("/api/voice/clone")
@limiter.limit("3/hour")  # Voice cloning is expensive
async def clone_voice(...):
    ...
```

### 3. Environment
- [ ] Use secrets management (AWS Secrets Manager, Doppler, etc.)
- [x] Never commit `.env` files
- [ ] Rotate API keys periodically

## ⚡ Performance Optimization

### 1. WebSocket Scaling
```python
# Use Redis pub/sub for multi-instance WebSocket
# backend/app/services/pubsub.py
import aioredis

class RedisPubSub:
    async def publish(self, channel: str, message: dict):
        await self.redis.publish(channel, json.dumps(message))
    
    async def subscribe(self, channel: str):
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(channel)
        return pubsub
```

### 2. Database Connection Pooling
```python
# backend/app/models/database.py
from sqlalchemy.pool import AsyncAdaptedQueuePool

engine = create_async_engine(
    DATABASE_URL,
    poolclass=AsyncAdaptedQueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)
```

### 3. Caching Strategy
- Cache user voice profiles (Redis)
- Cache translation results for common phrases
- Cache room tokens (short TTL)

## 📊 Monitoring & Observability

### 1. Error Tracking
```python
# backend/app/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=settings.sentry_dsn,
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.1,
)
```

### 2. Metrics to Track
- [x] Translation latency (STT + Translate + TTS)
- [ ] WebSocket connection count
- [ ] Active calls
- [ ] API error rates
- [ ] Voice clone success rate

### 3. Logging
```python
import structlog

logger = structlog.get_logger()

# Log pipeline metrics
logger.info(
    "translation_complete",
    user_id=user_id,
    source_lang=source,
    target_lang=target,
    stt_ms=metrics.stt_latency_ms,
    translate_ms=metrics.translate_latency_ms,
    tts_ms=metrics.tts_latency_ms,
    total_ms=metrics.total_latency_ms,
)
```

## 🌐 Infrastructure Setup

### Option A: Simple (Recommended for MVP)
| Component | Service | Cost |
|-----------|---------|------|
| Frontend | Vercel | Free |
| Backend | Railway | $5/mo |
| Database | Supabase | Free tier |
| Redis | Upstash | Free tier |

### Option B: Scalable
| Component | Service | Cost |
|-----------|---------|------|
| Frontend | Cloudflare Pages | Free |
| Backend | Fly.io (2+ instances) | $10/mo |
| Database | Neon / PlanetScale | $20/mo |
| Redis | Upstash Pro | $10/mo |
| CDN | Cloudflare | Free |

## 🚀 Deployment Commands

### Frontend (Vercel)
```bash
cd frontend
vercel --prod
```

### Backend (Railway/Fly.io)
```bash
# Railway
railway up

# Fly.io
fly launch
fly deploy
```

### Database Migration
```bash
cd backend
alembic upgrade head
```

## 📱 Mobile Considerations

For mobile apps later:
- [ ] React Native with Expo
- [ ] Use WebRTC for calls (already works)
- [ ] Push notifications for incoming calls
- [ ] Background audio handling

## 💰 Cost Estimation (Per Active User/Month)

| Usage Level | STT | Translation | TTS | WebRTC | Total |
|-------------|-----|-------------|-----|--------|-------|
| Light (1hr calls) | $0.26 | $0.50 | $1.00 | $0.24 | ~$2/user |
| Medium (5hr calls) | $1.30 | $2.50 | $5.00 | $1.20 | ~$10/user |
| Heavy (20hr calls) | $5.20 | $10.00 | $20.00 | $4.80 | ~$40/user |

## ✅ Pre-Launch Checklist

- [ ] All API keys configured
- [x] Database migrations run
- [x] SSL/HTTPS enabled
- [x] CORS configured for production domains
- [x] Rate limiting enabled
- [ ] Error tracking (Sentry) configured — code ready, need DSN
- [x] Logging configured (structlog)
- [x] Health check endpoint working
- [x] WebSocket reconnection logic tested
- [ ] Voice cloning tested end-to-end
- [ ] Translation latency < 500ms verified
- [ ] Load tested with concurrent users
- [x] Terms of Service / Privacy Policy
- [x] User consent for voice recording

## 🔧 Quick Start for Production

1. **Clone & configure:**
   ```bash
   cp .env.example .env
   # Fill in all API keys
   ```

2. **Deploy database:**
   ```bash
   # Create Supabase/Neon project, get connection string
   alembic upgrade head
   ```

3. **Deploy backend:**
   ```bash
   # Railway
   railway login
   railway init
   railway up
   ```

4. **Deploy frontend:**
   ```bash
   # Vercel
   cd frontend
   vercel --prod
   ```

5. **Test the pipeline:**
   - Sign up
   - Record voice (60s)
   - Start a call
   - Verify: Your voice → Their language
