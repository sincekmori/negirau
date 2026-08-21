# SPDX-License-Identifier: Apache-2.0
"""Exception hierarchy.

``NegirauError`` is the catch-all base; ``APIStatusError`` carries an HTTP
status and the API's machine-readable ``code``; common statuses get their own
subclass so callers can catch precisely.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import httpx


class NegirauError(Exception):
    """Base class for every error this SDK raises."""


class APIConnectionError(NegirauError):
    """The request never produced a response (DNS, TLS, refused, ...)."""

    def __init__(self, message: str = "Connection error.") -> None:
        """Store the display message."""
        super().__init__(message)


class APITimeoutError(APIConnectionError):
    """The request timed out."""

    def __init__(self) -> None:
        """Fix the message; the timeout budget lives on the client."""
        super().__init__("Request timed out.")


class APIStatusError(NegirauError):
    """A non-success HTTP response, with the API's ``code`` (e.g. "not_found")."""

    def __init__(self, status_code: int, code: str) -> None:
        """Store the status and code, and build the display message."""
        super().__init__(f"{status_code}: {code}")
        self.status_code = status_code
        self.code = code


class BadRequestError(APIStatusError):
    """HTTP 400."""


class NotFoundError(APIStatusError):
    """HTTP 404."""


class RateLimitError(APIStatusError):
    """HTTP 429."""


class InternalServerError(APIStatusError):
    """HTTP 5xx."""


_STATUS_CLASSES: dict[int, type[APIStatusError]] = {
    400: BadRequestError,
    404: NotFoundError,
    429: RateLimitError,
}

#: Status classification boundary shared with the client's retry logic.
INTERNAL_ERROR_FLOOR = 500


def make_status_error(response: httpx.Response) -> APIStatusError:
    """Build the most specific error class for a non-success response."""
    try:
        code = str(response.json().get("error", "unknown"))
    except ValueError:
        code = "unknown"
    status = response.status_code
    cls = _STATUS_CLASSES.get(status)
    if cls is None:
        cls = InternalServerError if status >= INTERNAL_ERROR_FLOOR else APIStatusError
    return cls(status, code)
