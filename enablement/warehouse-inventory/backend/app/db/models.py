"""SQLAlchemy models for the Inventory API domain entities.

Field decisions per Functional Design (domain-entities.md):
- Integer auto-increment primary keys.
- `price_cents`: integer cents, never a float, to avoid currency rounding
  errors. Conversion to/from a decimal dollar amount happens only at the
  API layer (see `app/api/currency.py`).
- `deleted_at`: nullable ISO 8601 UTC timestamp string. NULL = active.
  A nullable timestamp (rather than a boolean flag) also records *when*
  a soft delete happened.
"""
from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    deleted_at: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    code: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    deleted_at: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

    category: Mapped["Category"] = relationship(back_populates="products")
    stock_adjustments: Mapped[list["StockAdjustment"]] = relationship(
        back_populates="product"
    )


class StockAdjustment(Base):
    __tablename__ = "stock_adjustments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    resulting_balance: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="stock_adjustments")
