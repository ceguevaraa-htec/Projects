"""Unit tests for CategoryService — CAT-1..4."""
import pytest

from app.exceptions import ConflictError, NotFoundError
from app.services import category_service, product_service


def test_create_category_success(session):
    category = category_service.create_category(session, "Beverages")
    assert category.id is not None
    assert category.name == "Beverages"


def test_create_category_duplicate_name_rejected(session):
    category_service.create_category(session, "Beverages")
    with pytest.raises(ConflictError) as exc_info:
        category_service.create_category(session, "Beverages")
    assert exc_info.value.error_code == "CATEGORY_NAME_ALREADY_EXISTS"


def test_create_category_name_freed_after_hard_delete(session):
    category = category_service.create_category(session, "Seasonal")
    category_service.delete_category(session, category.id)  # zero products -> hard delete
    # Re-creating a hard-deleted category's name should succeed (freed) —
    # no ConflictError raised is the actual assertion; SQLite's rowid reuse
    # after deleting the only row means the new id isn't guaranteed to
    # differ, so id equality isn't the business rule under test here.
    recreated = category_service.create_category(session, "Seasonal")
    assert recreated.name == "Seasonal"
    assert recreated.deleted_at is None


def test_rename_category_success(session):
    category = category_service.create_category(session, "Snacks")
    renamed = category_service.rename_category(session, category.id, "Snacks & Chips")
    assert renamed.name == "Snacks & Chips"


def test_rename_category_not_found(session):
    with pytest.raises(NotFoundError):
        category_service.rename_category(session, 9999, "Anything")


def test_rename_category_to_same_name_is_noop_success(session):
    category = category_service.create_category(session, "Household")
    result = category_service.rename_category(session, category.id, "Household")
    assert result.name == "Household"


def test_rename_category_to_existing_other_name_rejected(session):
    category_service.create_category(session, "A")
    b = category_service.create_category(session, "B")
    with pytest.raises(ConflictError):
        category_service.rename_category(session, b.id, "A")


def test_delete_category_hard_delete_when_no_products(session):
    category = category_service.create_category(session, "Empty")
    result = category_service.delete_category(session, category.id)
    assert result is None
    assert category_service.list_categories_with_totals(session) == []


def test_delete_category_soft_delete_when_products_exist(session):
    category = category_service.create_category(session, "Beverages")
    product_service.create_product(session, "Soda", 199, "BEV-1", category.id, 10)

    result = category_service.delete_category(session, category.id)

    assert result is not None
    assert result.deleted_at is not None
    # Soft-deleted category excluded from listings.
    totals = category_service.list_categories_with_totals(session)
    assert totals == []


def test_delete_category_not_found(session):
    with pytest.raises(NotFoundError):
        category_service.delete_category(session, 9999)


def test_stock_totals_exclude_soft_deleted_products_under_active_category(session):
    category = category_service.create_category(session, "Snacks")
    p1 = product_service.create_product(session, "Chips", 299, "SNK-1", category.id, 10)
    product_service.create_product(session, "Pretzels", 199, "SNK-2", category.id, 5)

    # Adjust p1's stock so it has history, then soft-delete it.
    from app.services import stock_adjustment_service

    stock_adjustment_service.adjust_stock(session, p1.id, 1)
    product_service.delete_product(session, p1.id)

    totals = category_service.list_categories_with_totals(session)
    assert len(totals) == 1
    assert totals[0]["total_stock"] == 5  # only Pretzels' stock counted
