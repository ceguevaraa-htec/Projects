"""StockAdjustmentComponent — persistence access for the immutable stock
adjustment history.

Per Application Design: owns `stock_adjustments` persistence. Entries are
never updated or deleted (FR3.3) — only `record()` (insert) and read
operations exist.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import StockAdjustment


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def record(session: Session, product_id: int, delta: int, resulting_balance: int) -> StockAdjustment:
    adjustment = StockAdjustment(
        product_id=product_id,
        delta=delta,
        resulting_balance=resulting_balance,
        created_at=_utc_now_iso(),
    )
    session.add(adjustment)
    session.flush()
    return adjustment


def list_for_product(session: Session, product_id: int) -> list[StockAdjustment]:
    """Chronological (oldest first) history for a product. Works regardless
    of the product's active/soft-deleted status (FR3.4) — this component
    makes no active-status check; that belongs to the calling service."""
    stmt = (
        select(StockAdjustment)
        .where(StockAdjustment.product_id == product_id)
        .order_by(StockAdjustment.id.asc())
    )
    return session.scalars(stmt).all()


def count_for_product(session: Session, product_id: int) -> int:
    """Count of history entries (delete-eligibility check)."""
    stmt = select(StockAdjustment.id).where(StockAdjustment.product_id == product_id)
    return len(session.scalars(stmt).all())
