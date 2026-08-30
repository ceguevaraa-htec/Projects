"""`products` router — PROD-1..5."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.currency import dollars_to_cents
from app.api.schemas import (
    DeleteOutcomeResponse,
    ProductCreateRequest,
    ProductResponse,
    ProductUpdateRequest,
)
from app.db.session import get_session
from app.services import product_service

router = APIRouter(prefix="/products", tags=["products"])


@router.post("", response_model=ProductResponse, status_code=201)
def create_product(
    request: ProductCreateRequest, session: Session = Depends(get_session)
) -> ProductResponse:
    product = product_service.create_product(
        session,
        request.name,
        dollars_to_cents(request.price),
        request.code,
        request.category_id,
        request.initial_stock,
    )
    return ProductResponse.from_model(product)


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    request: ProductUpdateRequest,
    session: Session = Depends(get_session),
) -> ProductResponse:
    product = product_service.update_product(session, product_id, request.to_component_fields())
    return ProductResponse.from_model(product)


@router.delete("/{product_id}", response_model=DeleteOutcomeResponse)
def delete_product(
    product_id: int, session: Session = Depends(get_session)
) -> DeleteOutcomeResponse:
    result = product_service.delete_product(session, product_id)
    outcome = "soft_deleted" if result is not None else "hard_deleted"
    return DeleteOutcomeResponse(outcome=outcome)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, session: Session = Depends(get_session)) -> ProductResponse:
    product = product_service.get_product(session, product_id)
    return ProductResponse.from_model(product)


@router.get("", response_model=list[ProductResponse])
def list_products(
    sort_by: Literal["name", "price", "quantity"] = "name",
    sort_dir: Literal["asc", "desc"] = "asc",
    category_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
) -> list[ProductResponse]:
    products = product_service.list_products(session, sort_by, sort_dir, category_id)
    return [ProductResponse.from_model(product) for product in products]
