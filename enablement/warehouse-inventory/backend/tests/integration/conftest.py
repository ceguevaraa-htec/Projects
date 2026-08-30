"""Integration-test fixtures: a full FastAPI TestClient against a temporary
on-disk SQLite file, per the approved test-organization plan."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import create_all
from app.db.session import get_session
from app.main import app


@pytest.fixture()
def client(tmp_path):
    db_path = tmp_path / "integration_test.db"
    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"timeout": 5}, future=True
    )
    create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

    def _override_get_session():
        session = session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    app.dependency_overrides[get_session] = _override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()
