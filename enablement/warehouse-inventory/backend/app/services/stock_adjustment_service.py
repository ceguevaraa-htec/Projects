"""StockAdjustmentService — orchestrates stock-adjustment use cases.

Session-threading rule: `adjust_stock` is a check-then-write method; it
receives `session` as its first parameter and passes that same instance
into both ProductComponent and StockAdjustmentComponent calls, so the
stock update and the history insert commit together (NFR1 atomicity).

Business rule (already decided in Functional Design, not re-litigated
here): a zero delta is rejected as INVALID_ADJUSTMENT_DELTA — a no-op
adjustment is not a meaningful inventory event and would be noise in the
audit history (HIST-1).
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.components import product_component, stock_adjustment_component
from app.exceptions import ConflictError, InvariantViolationError, NotFoundError, ValidationError
from app.db.models import StockAdjustment


def adjust_stock(session: Session, product_id: int, delta: int) -> StockAdjustment:
    product = product_component.get_by_id(session, product_id)
    if product is None:
        raise NotFoundError("PRODUCT_NOT_FOUND", f"Product {product_id} does not exist.")

    if product.deleted_at is not None:
        raise ConflictError(
            "PRODUCT_INACTIVE",
            f"Product {product_id} is soft-deleted and cannot receive stock adjustments.",
        )

    if delta == 0:
        raise ValidationError(
            "INVALID_ADJUSTMENT_DELTA", "A stock adjustment's delta must not be zero."
        )

    resulting_balance = product.quantity + delta
    if resulting_balance < 0:
        raise InvariantViolationError(
            "STOCK_WOULD_GO_NEGATIVE", "Cannot decrease stock below zero."
        )

    # Session-threading: the same `session` flows into both calls below,
    # so the stock update and the history insert commit atomically.
    product_component.set_stock(session, product_id, resulting_balance)
    return stock_adjustment_component.record(session, product_id, delta, resulting_balance)


def get_history(session: Session, product_id: int) -> list[StockAdjustment]:
    """Works regardless of the product's active/soft-deleted status (FR3.4)."""
    product = product_component.get_by_id(session, product_id)
    if product is None:
        raise NotFoundError("PRODUCT_NOT_FOUND", f"Product {product_id} does not exist.")
    return stock_adjustment_component.list_for_product(session, product_id)
