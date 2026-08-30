"""Currency conversion boundary (Functional Design: domain-entities.md).

These are the only two functions in the codebase that convert between the
domain's integer-cents representation and a decimal dollar amount. No
component or service ever sees a float/decimal price — only `price_cents`.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal


def dollars_to_cents(amount: Decimal | str | float) -> int:
    """Convert a decimal dollar amount (e.g. 9.99) to integer cents (999)."""
    decimal_amount = Decimal(str(amount))
    cents = (decimal_amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(cents)


def cents_to_dollars(cents: int) -> Decimal:
    """Convert integer cents (999) to a decimal dollar amount (9.99)."""
    return (Decimal(cents) / 100).quantize(Decimal("0.01"))
