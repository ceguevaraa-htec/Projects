"""Shared pytest fixtures for the Inventory API test suite."""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base, create_all


@pytest.fixture()
def engine():
    """One in-memory SQLite engine per test, using StaticPool so the single
    in-memory database is shared across connections within the test instead
    of each connection getting its own empty database."""
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False, "timeout": 5},
        poolclass=StaticPool,
        future=True,
    )
    create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def session(engine):
    """One Session per test, bound to the in-memory engine above."""
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    sess = session_factory()
    yield sess
    sess.close()
