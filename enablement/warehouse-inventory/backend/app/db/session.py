"""SQLAlchemy engine/session setup.

Per NFR Design:
- SQLite engine configured with `connect_args={"timeout": 5}`, mapped by
  the pysqlite dialect to SQLite's `busy_timeout` pragma (5 seconds) so a
  write contending for a lock waits briefly instead of failing immediately.
  This is a connection-level setting, not an application-level retry loop.
- `get_session()` is a FastAPI dependency yielding exactly one Session per
  request, closed (and rolled back on exception) after the request
  completes. Every check-then-write service method receives this same
  session instance as its first parameter and must pass it, unchanged,
  into every component call it makes.
"""
from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DEFAULT_DATABASE_URL = "sqlite:///./inventory.db"


def make_engine(database_url: str | None = None):
    """Create a SQLAlchemy engine for the given (or default) database URL."""
    url = database_url or os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)
    connect_args = {"timeout": 5}
    if url == "sqlite:///:memory:":
        # In-memory SQLite needs a single shared connection across the
        # engine, or each new connection sees an empty database. Tests that
        # want a fresh in-memory DB should create their own engine via this
        # function with StaticPool (see backend/tests/conftest.py).
        connect_args["check_same_thread"] = False
    return create_engine(url, connect_args=connect_args, future=True)


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency: yield one Session per request."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
