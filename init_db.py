#!/usr/bin/env python
"""Initialize database with all tables from models."""
import asyncio
import sys
sys.path.insert(0, '/app')

from sqlalchemy.ext.asyncio import create_async_engine
from app.config import get_settings
from app.models.models import Base

async def init_db():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print('✓ Database initialized successfully')

if __name__ == "__main__":
    asyncio.run(init_db())
