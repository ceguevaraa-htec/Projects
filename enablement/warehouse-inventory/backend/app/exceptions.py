"""Domain exception hierarchy.

Per Functional Design (business-rules.md), each exception carries a
machine-parseable `error_code` and a human-readable `message`. The global
exception handler (app/api/error_handlers.py) maps each type to an HTTP
status and logs it.
"""
from __future__ import annotations


class DomainError(Exception):
    """Base class for all domain exceptions raised by services/components."""

    def __init__(self, error_code: str, message: str) -> None:
        self.error_code = error_code
        self.message = message
        super().__init__(message)


class NotFoundError(DomainError):
    """Referenced entity does not exist at all (no row, any status). Maps to HTTP 404."""


class ValidationError(DomainError):
    """Malformed input the request itself is responsible for. Maps to HTTP 400."""


class ConflictError(DomainError):
    """A uniqueness constraint or active-status requirement would be violated. Maps to HTTP 409."""


class InvariantViolationError(DomainError):
    """A well-formed request would violate a core business invariant. Maps to HTTP 422."""
