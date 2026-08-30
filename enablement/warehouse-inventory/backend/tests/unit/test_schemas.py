"""Unit tests for Pydantic schema (de)serialization, including a
property-based round-trip test (per NFR Requirements' partial-PBT scope)."""
from decimal import Decimal

from hypothesis import given
from hypothesis import strategies as st

from app.api.schemas import ProductCreateRequest, ProductResponse


def test_product_create_request_parses_decimal_price():
    request = ProductCreateRequest(
        name="Cola", price="9.99", code="BEV-1", category_id=1, initial_stock=10
    )
    assert request.price == Decimal("9.99")


def test_product_response_from_model_converts_cents_to_decimal():
    class _FakeProduct:
        id = 1
        name = "Cola"
        price_cents = 999
        code = "BEV-1"
        category_id = 1
        quantity = 10

    response = ProductResponse.from_model(_FakeProduct())
    assert response.price == Decimal("9.99")


@given(
    name=st.text(min_size=1, max_size=30),
    price=st.decimals(min_value="0.00", max_value="9999.99", places=2, allow_nan=False, allow_infinity=False),
    code=st.text(min_size=1, max_size=15),
    category_id=st.integers(min_value=1, max_value=1000),
    initial_stock=st.integers(min_value=0, max_value=100_000),
)
def test_product_create_request_round_trips_through_json(name, price, code, category_id, initial_stock):
    request = ProductCreateRequest(
        name=name, price=price, code=code, category_id=category_id, initial_stock=initial_stock
    )
    json_str = request.model_dump_json()
    reparsed = ProductCreateRequest.model_validate_json(json_str)
    assert reparsed == request
