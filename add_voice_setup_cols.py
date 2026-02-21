"""Add voice_setup_seen and voice_setup_skipped columns to user_preferences table."""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:bem7DKF9wmv_ghp8xcx@database-2.cnc0ao4o8j63.ap-southeast-1.rds.amazonaws.com:5432/voicetranslate?ssl=require"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        # Add voice_setup_seen column
        await conn.execute(text("""
            ALTER TABLE user_preferences
            ADD COLUMN IF NOT EXISTS voice_setup_seen BOOLEAN DEFAULT FALSE
        """))
        print("Added voice_setup_seen column")

        # Add voice_setup_skipped column
        await conn.execute(text("""
            ALTER TABLE user_preferences
            ADD COLUMN IF NOT EXISTS voice_setup_skipped BOOLEAN DEFAULT FALSE
        """))
        print("Added voice_setup_skipped column")

    await engine.dispose()
    print("Done!")

asyncio.run(main())
