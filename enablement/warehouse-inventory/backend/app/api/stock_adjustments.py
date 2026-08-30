"""`stock-adjustments` router — STK-1, STK-2, HIST-1.

Mounted under /products/{product_id}/stock-adjustments, per Functional
Design's single-endpoint, signed-delta decision (Q2: A).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.schemas import StockAdjustmentCreateRequest, StockAdjustmentResponse
from app.db.session import get_session
from app.services import stock_adjustment_service

router = APIRouter(prefix="/products/{product_id}/stock-adjustments", tags=["stock-adjustments"])


@router.post("", response_model=StockAdjustmentResponse, status_code=201)
def create_stock_adjustment(
    product_id: int,
    request: StockAdjustmentCreateRequest,
    session: Session = Depends(get_session),
) -> StockAdjustmentResponse:
    adjustment = stock_adjustment_service.adjust_stock(session, product_id, request.delta)
    return StockAdjustmentResponse.from_model(adjustment)


@router.get("", response_model=list[StockAdjustmentResponse])
def list_stock_adjustments(
    product_id: int, session: Session = Depends(get_session)
) -> list[StockAdjustmentResponse]:
    history = stock_adjustment_service.get_history(session, product_id)
    return [StockAdjustmentResponse.from_model(entry) for entry in history]
