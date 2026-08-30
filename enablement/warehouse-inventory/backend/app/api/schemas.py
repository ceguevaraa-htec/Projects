"""Pydantic request/response schemas.

The only place a decimal dollar `price` is seen by external callers — the
conversion to/from `price_cents` happens here via `app.api.currency`.
"""
from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.currency import cents_to_dollars, dollars_to_cents


# --- Category schemas -------------------------------------------------

class CategoryCreateRequest(BaseModel):
    name: str = Field(min_length=1)


class CategoryRenameRequest(BaseModel):
    name: str = Field(min_length=1)


class CategoryResponse(BaseModel):
    id: int
    name: str

    @classmethod
    def from_model(cls, category) -> "CategoryResponse":
        return cls(id=category.id, name=category.name)


class CategoryStockTotalResponse(BaseModel):
    id: int
    name: str
    total_stock: int


# --- Product schemas ---------------------------------------------------

class ProductCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    price: Decimal
    code: str = Field(min_length=1)
    category_id: int
    initial_stock: int = 0


class ProductUpdateRequest(BaseModel):
    # extra="forbid": a request that includes a `quantity`/`stock` field (not
    # a recognized field on this schema) is rejected by FastAPI/Pydantic at
    # the request-parsing boundary (HTTP 422), before it would ever reach
    # ProductService.update_product's own defense-in-depth check for the
    # same rule. Both layers enforce it; this is the one actually reachable
    # from an HTTP client, since `to_component_fields()` below only ever
    # extracts the fields this schema declares.
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    price: Decimal | None = None
    code: str | None = None
    category_id: int | None = None

    def to_component_fields(self) -> dict:
        fields = {}
        if self.name is not None:
            fields["name"] = self.name
        if self.price is not None:
            fields["price_cents"] = dollars_to_cents(self.price)
        if self.code is not None:
            fields["code"] = self.code
        if self.category_id is not None:
            fields["category_id"] = self.category_id
        return fields


class ProductResponse(BaseModel):
    id: int
    name: str
    price: Decimal
    code: str
    category_id: int
    quantity: int

    @classmethod
    def from_model(cls, product) -> "ProductResponse":
        return cls(
            id=product.id,
            name=product.name,
            price=cents_to_dollars(product.price_cents),
            code=product.code,
            category_id=product.category_id,
            quantity=product.quantity,
        )


# --- Stock adjustment schemas -------------------------------------------

class StockAdjustmentCreateRequest(BaseModel):
    delta: int

    @field_validator("delta")
    @classmethod
    def delta_must_be_meaningful(cls, value: int) -> int:
        # Note: the *authoritative* rejection of delta == 0 happens in
        # StockAdjustmentService (INVALID_ADJUSTMENT_DELTA), so it is logged
        # and returned with the standard error-code shape. This validator is
        # intentionally a no-op passthrough — Pydantic-level type validation
        # (delta must be an int) is all that belongs here.
        return value


class StockAdjustmentResponse(BaseModel):
    id: int
    product_id: int
    delta: int
    resulting_balance: int
    created_at: str

    @classmethod
    def from_model(cls, adjustment) -> "StockAdjustmentResponse":
        return cls(
            id=adjustment.id,
            product_id=adjustment.product_id,
            delta=adjustment.delta,
            resulting_balance=adjustment.resulting_balance,
            created_at=adjustment.created_at,
        )


class ErrorResponse(BaseModel):
    error_code: str
    message: str


class DeleteOutcomeResponse(BaseModel):
    """Response for a DELETE that may have hard- or soft-deleted the entity.

    Added per Unit 2's Functional Design (Question 1): the UI needs to know
    which branch occurred to present distinct UX ("permanently deleted" vs.
    "archived because it still has dependents").
    """

    outcome: str  # "hard_deleted" | "soft_deleted"
