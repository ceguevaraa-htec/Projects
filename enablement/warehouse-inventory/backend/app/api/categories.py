"""`categories` router — CAT-1..4."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.schemas import (
    CategoryCreateRequest,
    CategoryRenameRequest,
    CategoryResponse,
    CategoryStockTotalResponse,
    DeleteOutcomeResponse,
)
from app.db.session import get_session
from app.services import category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.post("", response_model=CategoryResponse, status_code=201)
def create_category(
    request: CategoryCreateRequest, session: Session = Depends(get_session)
) -> CategoryResponse:
    category = category_service.create_category(session, request.name)
    return CategoryResponse.from_model(category)


@router.patch("/{category_id}", response_model=CategoryResponse)
def rename_category(
    category_id: int,
    request: CategoryRenameRequest,
    session: Session = Depends(get_session),
) -> CategoryResponse:
    category = category_service.rename_category(session, category_id, request.name)
    return CategoryResponse.from_model(category)


@router.delete("/{category_id}", response_model=DeleteOutcomeResponse)
def delete_category(
    category_id: int, session: Session = Depends(get_session)
) -> DeleteOutcomeResponse:
    result = category_service.delete_category(session, category_id)
    outcome = "soft_deleted" if result is not None else "hard_deleted"
    return DeleteOutcomeResponse(outcome=outcome)


@router.get("", response_model=list[CategoryStockTotalResponse])
def list_categories(session: Session = Depends(get_session)) -> list[CategoryStockTotalResponse]:
    totals = category_service.list_categories_with_totals(session)
    return [CategoryStockTotalResponse(**row) for row in totals]
