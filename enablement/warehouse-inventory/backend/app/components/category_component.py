"""CategoryComponent — persistence access and low-level rules for categories.

Per Application Design: owns `categories` persistence, category-name
uniqueness (checked against all rows regardless of `deleted_at`), and
per-category stock totals (excluding soft-deleted categories AND stock
from soft-deleted products under an active category — explicit rule from
the Application Design review).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Category, Product


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create(session: Session, name: str) -> Category:
    category = Category(name=name)
    session.add(category)
    session.flush()
    return category


def get_by_id(session: Session, category_id: int) -> Category | None:
    return session.get(Category, category_id)


def list_active(session: Session) -> list[Category]:
    stmt = select(Category).where(Category.deleted_at.is_(None)).order_by(Category.name.asc())
    return list(session.scalars(stmt).all())


def rename(session: Session, category_id: int, new_name: str) -> Category:
    category = session.get(Category, category_id)
    category.name = new_name
    session.flush()
    return category


def soft_delete(session: Session, category_id: int) -> Category:
    category = session.get(Category, category_id)
    category.deleted_at = _utc_now_iso()
    session.flush()
    return category


def hard_delete(session: Session, category_id: int) -> None:
    category = session.get(Category, category_id)
    session.delete(category)
    session.flush()


def name_exists(session: Session, name: str, exclude_category_id: int | None = None) -> bool:
    """Uniqueness check against all rows regardless of deleted_at (FR1.1).

    When `exclude_category_id` is given (rename self-conflict case), that
    category's own row is excluded from the check.
    """
    stmt = select(Category.id).where(Category.name == name)
    if exclude_category_id is not None:
        stmt = stmt.where(Category.id != exclude_category_id)
    return session.scalars(stmt).first() is not None


def get_stock_totals(session: Session) -> list[dict]:
    """Per active-category stock totals, excluding soft-deleted products
    even when their category is active (explicit rule, Application Design)."""
    stmt = (
        select(
            Category.id,
            Category.name,
            func.coalesce(func.sum(Product.quantity), 0).label("total_stock"),
        )
        .outerjoin(
            Product,
            (Product.category_id == Category.id) & (Product.deleted_at.is_(None)),
        )
        .where(Category.deleted_at.is_(None))
        .group_by(Category.id, Category.name)
        .order_by(Category.name.asc())
    )
    return [
        {"id": row.id, "name": row.name, "total_stock": row.total_stock}
        for row in session.execute(stmt)
    ]
