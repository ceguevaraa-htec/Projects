"""Declarative base and schema bootstrap for the Inventory API.

Per NFR Requirements: schema is created on application startup
(`create_all`), no migration framework is used.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy models."""


def create_all(engine) -> None:
    """Create all tables defined on `Base` if they don't already exist."""
    Base.metadata.create_all(bind=engine)
