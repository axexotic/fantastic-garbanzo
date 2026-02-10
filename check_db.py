import asyncio
from sqlalchemy import text
from app.models.database import async_session, engine
from app.models.models import Base

async def main():
    # Check existing tables
    async with async_session() as db:
        result = await db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'"))
        tables = [row[0] for row in result.all()]
        print("Existing tables:", tables)
    
    # Create any missing tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Check again
    async with async_session() as db:
        result = await db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'"))
        tables = [row[0] for row in result.all()]
        print("Tables after create_all:", tables)

asyncio.run(main())
