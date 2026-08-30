"""Unit tests for the SQLAlchemy domain models."""
from app.db.models import Category, Product, StockAdjustment


def test_category_defaults(session):
    category = Category(name="Beverages")
    session.add(category)
    session.commit()

    assert category.id is not None
    assert category.name == "Beverages"
    assert category.deleted_at is None


def test_product_defaults_and_category_relationship(session):
    category = Category(name="Snacks")
    session.add(category)
    session.commit()

    product = Product(
        name="Chips",
        price_cents=299,
        code="SNK-001",
        category_id=category.id,
        quantity=10,
    )
    session.add(product)
    session.commit()

    assert product.id is not None
    assert product.deleted_at is None
    assert product.category.name == "Snacks"
    assert category.products[0].code == "SNK-001"


def test_stock_adjustment_references_product(session):
    category = Category(name="Household")
    session.add(category)
    session.commit()

    product = Product(
        name="Sponges",
        price_cents=150,
        code="HH-001",
        category_id=category.id,
        quantity=5,
    )
    session.add(product)
    session.commit()

    adjustment = StockAdjustment(
        product_id=product.id,
        delta=5,
        resulting_balance=10,
        created_at="2026-08-30T10:00:00Z",
    )
    session.add(adjustment)
    session.commit()

    assert adjustment.id is not None
    assert adjustment.product.code == "HH-001"
    assert product.stock_adjustments[0].delta == 5


def test_soft_delete_marker_is_nullable_timestamp(session):
    category = Category(name="Temporary")
    session.add(category)
    session.commit()

    category.deleted_at = "2026-08-30T11:00:00Z"
    session.commit()

    refetched = session.get(Category, category.id)
    assert refetched.deleted_at == "2026-08-30T11:00:00Z"
