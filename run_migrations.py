#!/usr/bin/env python
"""Run Alembic migrations."""
import sys
import asyncio
sys.path.insert(0, '/app')

from alembic import command
from alembic.config import Config

config = Config('/app/alembic.ini')
command.upgrade(config, 'head')
print('✓ Migrations applied')
