"""CategoryService — orchestrates category use cases.

Session-threading rule (per the Code Generation plan's explicit
refinement): `delete_category` is the one check-then-write method here; it
receives `session` as its first parameter (sourced by the caller from
`Depends(get_session)`) and passes that same instance into both the
ProductComponent and CategoryComponent calls it makes. No new session is
ever created inside this module.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.components import category_component, product_component
from app.exceptions import ConflictError, NotFoundError
from app.db.models import Category


def create_category(session: Session, name: str) -> Category:
    if category_component.name_exists(session, name):
        raise ConflictError(
            "CATEGORY_NAME_ALREADY_EXISTS",
            f"A category named '{name}' already exists.",
        )
    return category_component.create(session, name)


def rename_category(session: Session, category_id: int, new_name: str) -> Category:
    category = category_component.get_by_id(session, category_id)
    if category is None:
        raise NotFoundError("CATEGORY_NOT_FOUND", f"Category {category_id} does not exist.")

    if category.name == new_name:
        # Self-conflict no-op (Q3: A) — renaming to the same name succeeds
        # without touching the uniqueness check.
        return category

    if category_component.name_exists(session, new_name, exclude_category_id=category_id):
        raise ConflictError(
            "CATEGORY_NAME_ALREADY_EXISTS",
            f"A category named '{new_name}' already exists.",
        )
    return category_component.rename(session, category_id, new_name)


def delete_category(session: Session, category_id: int) -> Category | None:
    """Returns the soft-deleted Category on soft-delete, or None on hard-delete."""
    category = category_component.get_by_id(session, category_id)
    if category is None:
        raise NotFoundError("CATEGORY_NOT_FOUND", f"Category {category_id} does not exist.")

    # Session-threading: the same `session` flows into both calls below.
    referencing_count = product_component.count_by_category(session, category_id)
    if referencing_count == 0:
        category_component.hard_delete(session, category_id)
        return None
    return category_component.soft_delete(session, category_id)


def list_categories_with_totals(session: Session) -> list[dict]:
    return category_component.get_stock_totals(session)
