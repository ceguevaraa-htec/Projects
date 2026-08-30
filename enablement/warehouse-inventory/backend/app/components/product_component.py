"""ProductComponent — persistence access and low-level rules for products.

Per Application Design: owns `products` persistence, product-code
uniqueness (against all rows regardless of `deleted_at`), and stock
read/write. `update()` never accepts a quantity/stock field — the only
path to change stock is StockAdjustmentService.adjust_stock() via
`set_stock()` below (explicit rule from the Application Design review).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Product

_UPDATABLE_FIELDS = {"name", "price_cents", "code", "category_id"}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create(
    session: Session,
    name: str,
    price_cents: int,
    code: str,
    category_id: int,
    initial_stock: int,
) -> Product:
    product = Product(
        name=name,
        price_cents=price_cents,
        code=code,
        category_id=category_id,
        quantity=initial_stock,
    )
    session.add(product)
    session.flush()
    return product


def get_by_id(session: Session, product_id: int) -> Product | None:
    return session.get(Product, product_id)


def list_products(
    session: Session,
    sort_by: str = "name",
    sort_dir: str = "asc",
    category_id_filter: int | None = None,
) -> list[Product]:
    """Named `list_products` (not `list`) to avoid shadowing the builtin
    within this module's namespace."""
    column = {
        "name": Product.name,
        "price": Product.price_cents,
        "quantity": Product.quantity,
    }.get(sort_by, Product.name)
    order = column.desc() if sort_dir == "desc" else column.asc()

    stmt = select(Product).where(Product.deleted_at.is_(None)).order_by(order)
    if category_id_filter is not None:
        stmt = stmt.where(Product.category_id == category_id_filter)
    return session.scalars(stmt).all()


def update(session: Session, product_id: int, fields: dict) -> Product:
    """`fields` must exclude quantity/stock — see module docstring."""
    if "quantity" in fields or "stock" in fields:
        raise ValueError(
            "ProductComponent.update() does not accept a quantity/stock field; "
            "use StockAdjustmentService.adjust_stock() instead."
        )
    product = session.get(Product, product_id)
    for key, value in fields.items():
        if key in _UPDATABLE_FIELDS:
            setattr(product, key, value)
    session.flush()
    return product


def soft_delete(session: Session, product_id: int) -> Product:
    product = session.get(Product, product_id)
    product.deleted_at = _utc_now_iso()
    session.flush()
    return product


def hard_delete(session: Session, product_id: int) -> None:
    product = session.get(Product, product_id)
    session.delete(product)
    session.flush()


def code_exists(session: Session, code: str, exclude_product_id: int | None = None) -> bool:
    """Uniqueness check against all rows regardless of deleted_at (FR2.3)."""
    stmt = select(Product.id).where(Product.code == code)
    if exclude_product_id is not None:
        stmt = stmt.where(Product.id != exclude_product_id)
    return session.scalars(stmt).first() is not None


def count_by_category(session: Session, category_id: int) -> int:
    """Count of products (active + soft-deleted) referencing a category."""
    stmt = select(Product.id).where(Product.category_id == category_id)
    return len(session.scalars(stmt).all())


def set_stock(session: Session, product_id: int, new_quantity: int) -> Product:
    """Persist an updated stock quantity. Called only by
    StockAdjustmentService.adjust_stock() within its transaction."""
    product = session.get(Product, product_id)
    product.quantity = new_quantity
    session.flush()
    return product
