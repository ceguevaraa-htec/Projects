"""Property-based tests for the currency conversion boundary.

Per the Requirements Analysis PBT decision (Partial): applied to pure
functions and serialization round-trips. dollars_to_cents()/
cents_to_dollars() is exactly such a round-trip pair.
"""
from decimal import Decimal

from hypothesis import given
from hypothesis import strategies as st

from app.api.currency import cents_to_dollars, dollars_to_cents


def test_known_values():
    assert dollars_to_cents("9.99") == 999
    assert cents_to_dollars(999) == Decimal("9.99")
    assert dollars_to_cents("20.00") == 2000
    assert cents_to_dollars(2000) == Decimal("20.00")


@given(st.integers(min_value=0, max_value=10_000_000))
def test_cents_to_dollars_to_cents_round_trips(cents: int):
    dollars = cents_to_dollars(cents)
    assert dollars_to_cents(dollars) == cents


@given(
    st.decimals(
        min_value="0.00", max_value="100000.00", places=2, allow_nan=False, allow_infinity=False
    )
)
def test_dollars_to_cents_to_dollars_round_trips(amount: Decimal):
    cents = dollars_to_cents(amount)
    assert cents_to_dollars(cents) == amount
