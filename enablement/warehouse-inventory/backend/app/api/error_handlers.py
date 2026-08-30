"""Global exception handlers — NFR3 (global error catching + logging).

Registered on the FastAPI app instance in main.py. Each handler logs the
error with request context and returns the structured
`{"error_code", "message"}` body (Q5: A) at the mapped HTTP status
(business-rules.md's exception -> HTTP table).
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.exceptions import ConflictError, DomainError, InvariantViolationError, NotFoundError, ValidationError

logger = logging.getLogger(__name__)

_STATUS_BY_EXCEPTION = {
    NotFoundError: 404,
    ValidationError: 400,
    ConflictError: 409,
    InvariantViolationError: 422,
}


def _log_and_respond(request: Request, status_code: int, error_code: str, message: str) -> JSONResponse:
    logger.error(
        "Request failed: %s %s -> %s %s: %s",
        request.method,
        request.url.path,
        status_code,
        error_code,
        message,
    )
    return JSONResponse(status_code=status_code, content={"error_code": error_code, "message": message})


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def handle_domain_error(request: Request, exc: DomainError) -> JSONResponse:
        status_code = _STATUS_BY_EXCEPTION.get(type(exc), 500)
        return _log_and_respond(request, status_code, exc.error_code, exc.message)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "error_code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred.",
            },
        )
