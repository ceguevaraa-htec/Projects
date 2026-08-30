"""Unit tests for ProductService — PROD-1..5."""
import pytest

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.services import category_service, product_service, stock_adjustment_service


@pytest.fixture()
def category(session):
    return category_service.create_category(session, "Beverages")


def test_create_product_success(session, category):
    product = product_service.create_product(session, "Cola", 199, "BEV-1", category.id, 20)
    assert product.id is not None
    assert product.quantity == 20


def test_create_product_category_not_found(session):
    with pytest.raises(NotFoundError):
        product_service.create_product(session, "Cola", 199, "BEV-1", 9999, 20)


def test_create_product_category_inactive_rejected(session, category):
    # Give the category a product first, so deleting it soft-deletes rather
    # than hard-deletes (hard-delete would make the category not-found
    # rather than inactive — a different, already-covered case).
    product_service.create_product(session, "Cola", 199, "BEV-1", category.id, 20)
    category_service.delete_category(session, category.id)  # has a product -> soft delete

    with pytest.raises(ConflictError) as exc_info:
        product_service.create_product(session, "Sprite", 199, "BEV-2", category.id, 20)
    assert exc_info.value.error_code == "CATEGORY_INACTIVE"


def test_create_product_duplicate_code_rejected(session, category):
    product_service.create_product(session, "Cola", 199, "BEV-1", category.id, 20)
    with pytest.raises(ConflictError) as exc_info:
        product_service.create_product(session, "Diet Cola", 199, "BEV-1", category.id, 5)
    assert exc_info.value.error_code == "PRODUCT_CODE_ALREADY_EXISTS"


def test_create_product_negative_initial_stock_rejected(session, category):
    with pytest.raises(ValidationError) as exc_info:
        product_service.create_product(session, "Cola", 199, "BEV-1", category.id, -1)
    assert exc_info.value.error_code == "INVALID_INITIAL_STOCK"


def test_update_product_name_and_price(session, category):
    product = product_service.create_product(session, "Cola", 199, "BEV-1", category.id, 20)
    updated = product_service.update_product(session, product.id, {"name": "Cola Classic", "price_cents": 249})
    assert updated.name == "Cola Classic"
    assert updated.price_cents == 249


def test_update_product_rejects_quantity_field(session, category):
    product = product_service.create_product(session, "Cola", 199, "BEV-1", category.id, 20)
    with pytest.raises(ValidationError):
        product_service.update_product(session, product.id, {"quantity": 100})


def test_update_product_category_inactive_rejected(session, category):
    product = product_service.create_product(session, "Cola", 199, "BEV-1", category.id, 20)
    other_category = category_service.create_category(session, "Snacks")
    # Give it a product first so its delete soft-deletes (see rationale in
    # test_create_product_category_inactive_rejected above).
    product_service.create_product(session, "Chips", 299, "SNK-1", other_category.id, 10)
    category_service.delete_category(session, other_category.id)  # has a product -> soft delete

    with pytest.raises(ConflictError) as exc_info:
        product_service.update_product(session, product.id, {"category_id": other_category.id})
    assert exc_info.value.error_code == "CATEGORY_INACTIVE"


def test_update_product_duplicate_code_rejected(session, category):
    product_service.create_product(session, "Cola", 199, "BEV-1", category.id, 20)
    p2 = product_service.create_product(session, "Sprite", 199, "BEV-2", category.id, 20)
    with pytest.raises(ConflictError):
        product_service.update_product(session, p2.id, {"code": "BEV-1"})


def test_update_product_not_found(session):
    with pytest.raises(NotFoundError):
        product_service.update_product(session, 9999, {"name": "Anything"})


def test_delete_product_hard_delete_when_no_history(session, category):
    product = product_service.create_product(session, "Cola", 199, "BEV-1", category.id, 20)
    result = product_service.delete_product(session, product.id)
    assert result is None
    # Code is freed and can be reused (no ConflictError raised is the
    # actual assertion — see the category-name-reuse test for why id
    # equality isn't asserted here).
    recreated = product_service.create_product(session, "New Cola", 199, "BEV-1", category.id, 5)
    assert recreated.code == "BEV-1"
    assert recreated.deleted_at is None


def test_delete_product_soft_delete_when_history_exists(session, category):
    product = product_service.create_product(session, "Cola", 199, "BEV-1", category.id, 20)
    stock_adjustment_service.adjust_stock(session, product.id, 5)

    result = product_service.delete_product(session, product.id)

    assert result is not None
    assert result.deleted_at is not None
    # Code remains reserved.
    with pytest.raises(ConflictError):
        product_service.create_product(session, "New Cola", 199, "BEV-1", category.id, 5)


def test_delete_product_not_found(session):
    with pytest.raises(NotFoundError):
        product_service.delete_product(session, 9999)


def test_get_product_detail(session, category):
    product = product_service.create_product(session, "Cola", 199, "BEV-1", category.id, 20)
    fetched = product_service.get_product(session, product.id)
    assert fetched.name == "Cola"


def test_get_product_not_found(session):
    with pytest.raises(NotFoundError):
        product_service.get_product(session, 9999)


def test_list_products_sort_and_filter(session, category):
    other_category = category_service.create_category(session, "Snacks")
    product_service.create_product(session, "Cola", 199, "BEV-1", category.id, 20)
    product_service.create_product(session, "Water", 99, "BEV-2", category.id, 50)
    product_service.create_product(session, "Chips", 299, "SNK-1", other_category.id, 10)

    by_category = product_service.list_products(session, category_id_filter=category.id)
    assert {p.code for p in by_category} == {"BEV-1", "BEV-2"}

    sorted_by_price_desc = product_service.list_products(session, sort_by="price", sort_dir="desc")
    prices = [p.price_cents for p in sorted_by_price_desc]
    assert prices == sorted(prices, reverse=True)


def test_list_products_excludes_soft_deleted(session, category):
    product = product_service.create_product(session, "Cola", 199, "BEV-1", category.id, 20)
    stock_adjustment_service.adjust_stock(session, product.id, 1)
    product_service.delete_product(session, product.id)

    listing = product_service.list_products(session)
    assert listing == []
