"""FastAPI application entrypoint — Unit 1: Inventory API.

Startup responsibilities (NFR Design / logical-components.md):
- Configure logging once (basicConfig + per-module getLogger elsewhere).
- Create the database schema if it doesn't exist yet (no migrations).
- Mount the per-domain routers.
- Register the global exception handlers.
- Serve Unit 2's static frontend, once it exists, from /.
"""
from __future__ import annotations

import logging
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.categories import router as categories_router
from app.api.error_handlers import register_exception_handlers
from app.api.products import router as products_router
from app.api.stock_adjustments import router as stock_adjustments_router
from app.db.base import create_all
from app.db.session import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    create_all(engine)
    yield


app = FastAPI(title="Warehouse Inventory API", version="1.0.0", lifespan=lifespan)

app.include_router(categories_router)
app.include_router(products_router)
app.include_router(stock_adjustments_router)

register_exception_handlers(app)

_frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
if _frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
