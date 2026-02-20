#!/usr/bin/env python
"""Register existing migrations in Alembic."""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
import sys
sys.path.insert(0, '/app')
from app.config import get_settings

async def register_migrations():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    async with engine.begin() as conn:
        # Create alembic_version table if it doesn't exist
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS alembic_version (
                version_num varchar(32) NOT NULL PRIMARY KEY
            )
        """))
        # Clear existing entries
        await conn.execute(text("DELETE FROM alembic_version"))
        # Mark all migrations as applied
        await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('002_subscriptions_recording')"))
        await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('003_webhooks_notifications')"))
    await engine.dispose()
    print('✓ Alembic version registered')

try:
    asyncio.run(register_migrations())
except Exception as e:
    print(f'Error: {e}')
