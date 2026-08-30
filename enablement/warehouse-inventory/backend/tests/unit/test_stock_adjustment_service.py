"""Unit tests for StockAdjustmentService — STK-1, STK-2, HIST-1."""
import pytest

from app.exceptions import ConflictError, InvariantViolationError, NotFoundError, ValidationError
from app.services import category_service, product_service, stock_adjustment_service


@pytest.fixture()
def product(session):
    category = category_service.create_category(session, "Beverages")
    return product_service.create_product(session, "Cola", 199, "BEV-1", category.id, 10)


def test_increase_stock_success(session, product):
    adjustment = stock_adjustment_service.adjust_stock(session, product.id, 5)
    assert adjustment.delta == 5
    assert adjustment.resulting_balance == 15

    refetched = product_service.get_product(session, product.id)
    assert refetched.quantity == 15


def test_decrease_stock_success(session, product):
    adjustment = stock_adjustment_service.adjust_stock(session, product.id, -4)
    assert adjustment.delta == -4
    assert adjustment.resulting_balance == 6


def test_decrease_stock_below_zero_rejected(session, product):
    with pytest.raises(InvariantViolationError) as exc_info:
        stock_adjustment_service.adjust_stock(session, product.id, -11)
    assert exc_info.value.error_code == "STOCK_WOULD_GO_NEGATIVE"

    # No partial write: stock unchanged, no history entry created.
    refetched = product_service.get_product(session, product.id)
    assert refetched.quantity == 10
    assert stock_adjustment_service.get_history(session, product.id) == []


def test_zero_delta_rejected(session, product):
    with pytest.raises(ValidationError) as exc_info:
        stock_adjustment_service.adjust_stock(session, product.id, 0)
    assert exc_info.value.error_code == "INVALID_ADJUSTMENT_DELTA"


def test_adjustment_on_soft_deleted_product_rejected(session, product):
    stock_adjustment_service.adjust_stock(session, product.id, 1)  # gives it history
    product_service.delete_product(session, product.id)  # soft-delete

    with pytest.raises(ConflictError) as exc_info:
        stock_adjustment_service.adjust_stock(session, product.id, 1)
    assert exc_info.value.error_code == "PRODUCT_INACTIVE"


def test_adjustment_on_nonexistent_product_rejected(session):
    with pytest.raises(NotFoundError):
        stock_adjustment_service.adjust_stock(session, 9999, 5)


def test_history_chronological_order(session, product):
    stock_adjustment_service.adjust_stock(session, product.id, 5)
    stock_adjustment_service.adjust_stock(session, product.id, -2)
    stock_adjustment_service.adjust_stock(session, product.id, 10)

    history = stock_adjustment_service.get_history(session, product.id)
    assert [entry.delta for entry in history] == [5, -2, 10]
    assert [entry.resulting_balance for entry in history] == [15, 13, 23]


def test_history_retrievable_for_soft_deleted_product(session, product):
    stock_adjustment_service.adjust_stock(session, product.id, 1)
    product_service.delete_product(session, product.id)

    history = stock_adjustment_service.get_history(session, product.id)
    assert len(history) == 1


def test_history_for_nonexistent_product_rejected(session):
    with pytest.raises(NotFoundError):
        stock_adjustment_service.get_history(session, 9999)
