"""ProductService — orchestrates product use cases.

Session-threading rule: `create_product`, `update_product`, and
`delete_product` are check-then-write methods; each receives `session` as
its first parameter and passes that same instance into every
ProductComponent/CategoryComponent/StockAdjustmentComponent call it makes.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.components import category_component, product_component, stock_adjustment_component
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.db.models import Product


def _assert_category_active(session: Session, category_id: int) -> None:
    category = category_component.get_by_id(session, category_id)
    if category is None:
        raise NotFoundError("CATEGORY_NOT_FOUND", f"Category {category_id} does not exist.")
    if category.deleted_at is not None:
        raise ConflictError(
            "CATEGORY_INACTIVE",
            f"Category {category_id} is soft-deleted and cannot be assigned to a product.",
        )


def create_product(
    session: Session,
    name: str,
    price_cents: int,
    code: str,
    category_id: int,
    initial_stock: int,
) -> Product:
    _assert_category_active(session, category_id)

    if product_component.code_exists(session, code):
        raise ConflictError(
            "PRODUCT_CODE_ALREADY_EXISTS", f"A product with code '{code}' already exists."
        )

    if initial_stock < 0:
        raise ValidationError("INVALID_INITIAL_STOCK", "initial_stock must be >= 0.")

    return product_component.create(
        session, name, price_cents, code, category_id, initial_stock
    )


def update_product(session: Session, product_id: int, fields: dict) -> Product:
    product = product_component.get_by_id(session, product_id)
    if product is None:
        raise NotFoundError("PRODUCT_NOT_FOUND", f"Product {product_id} does not exist.")

    if "quantity" in fields or "stock" in fields:
        raise ValidationError(
            "VALIDATION_ERROR",
            "Stock quantity cannot be changed via product update; "
            "use the stock-adjustment endpoint instead.",
        )

    new_category_id = fields.get("category_id")
    if new_category_id is not None and new_category_id != product.category_id:
        _assert_category_active(session, new_category_id)

    new_code = fields.get("code")
    if new_code is not None and new_code != product.code:
        if product_component.code_exists(session, new_code, exclude_product_id=product_id):
            raise ConflictError(
                "PRODUCT_CODE_ALREADY_EXISTS",
                f"A product with code '{new_code}' already exists.",
            )

    return product_component.update(session, product_id, fields)


def delete_product(session: Session, product_id: int) -> Product | None:
    """Returns the soft-deleted Product on soft-delete, or None on hard-delete."""
    product = product_component.get_by_id(session, product_id)
    if product is None:
        raise NotFoundError("PRODUCT_NOT_FOUND", f"Product {product_id} does not exist.")

    history_count = stock_adjustment_component.count_for_product(session, product_id)
    if history_count == 0:
        product_component.hard_delete(session, product_id)
        return None
    return product_component.soft_delete(session, product_id)


def get_product(session: Session, product_id: int) -> Product:
    product = product_component.get_by_id(session, product_id)
    if product is None:
        raise NotFoundError("PRODUCT_NOT_FOUND", f"Product {product_id} does not exist.")
    return product


def list_products(
    session: Session,
    sort_by: str = "name",
    sort_dir: str = "asc",
    category_id_filter: int | None = None,
) -> list[Product]:
    return product_component.list_products(session, sort_by, sort_dir, category_id_filter)
