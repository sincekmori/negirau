# SPDX-License-Identifier: Apache-2.0
"""The ``Negirau`` / ``AsyncNegirau`` clients (httpx-based).

Private module: everything public is re-exported through ``negirau``.
The clients own transport concerns (base URL, timeout, retries with
exponential backoff); the API surface lives on the resources
(``client.subjects``).
"""

from __future__ import annotations

import asyncio
import time
from typing import TYPE_CHECKING

import httpx
from typing_extensions import Self

from negirau._exceptions import (
    INTERNAL_ERROR_FLOOR,
    APIConnectionError,
    APITimeoutError,
    NegirauError,
    make_status_error,
)
from negirau.resources import (
    AsyncSubjects,
    Subjects,
)

if TYPE_CHECKING:
    from types import TracebackType

DEFAULT_BASE_URL = "https://api.negirau.com/v1"
DEFAULT_TIMEOUT = 10.0
DEFAULT_MAX_RETRIES = 2

# Retryable statuses: timeouts, conflicts, throttles, 5xx.
_RETRYABLE_STATUS = frozenset({408, 409, 429})


def _should_retry(status_code: int) -> bool:
    return status_code in _RETRYABLE_STATUS or status_code >= INTERNAL_ERROR_FLOOR


def _backoff_seconds(attempt: int) -> float:
    return min(0.5 * 2**attempt, 8.0)


def _clean_params(params: dict[str, str | int | None]) -> dict[str, str]:
    return {key: str(value) for key, value in params.items() if value is not None}


class _Retry:
    """Sentinel: the attempt failed retryably; back off and go again."""


_RETRY = _Retry()


def _fail_or_retry(error: NegirauError, *, last: bool, cause: Exception) -> _Retry:
    if last:
        raise error from cause
    return _RETRY


def _resolve(response: httpx.Response, *, last: bool) -> object:
    if response.status_code == httpx.codes.OK:
        return response.json()
    if last or not _should_retry(response.status_code):
        raise make_status_error(response)
    return _RETRY


class Negirau:
    """Synchronous client for the Negirau public API.

    Entry point::

        from negirau import Negirau

        client = Negirau()
        page = client.subjects.list(q="消防")

    The API is read-only, anonymous, and returns counts only as coarse
    buckets ("100+") — that is the service's anti-ranking design.
    """

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        http_client: httpx.Client | None = None,
    ) -> None:
        """Create a client; ``http_client`` overrides the built-in transport."""
        self._http = http_client or httpx.Client(base_url=base_url, timeout=timeout)
        self.max_retries = max_retries
        self.subjects = Subjects(self)

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._http.close()

    def __enter__(self) -> Self:
        """Support ``with Negirau() as client:``."""
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        """Close on context-manager exit."""
        self.close()

    def get(self, path: str, params: dict[str, str | int | None]) -> object:
        """GET a spec-relative path with retries; returns the parsed JSON body."""
        query = _clean_params(params)
        for attempt in range(self.max_retries + 1):
            result = self._attempt(path, query, last=attempt == self.max_retries)
            if not isinstance(result, _Retry):
                return result
            time.sleep(_backoff_seconds(attempt))
        raise AssertionError  # pragma: no cover — the loop always returns or raises

    def _attempt(self, path: str, query: dict[str, str], *, last: bool) -> object:
        try:
            response = self._http.get(path, params=query)
        except httpx.TimeoutException as error:
            return _fail_or_retry(APITimeoutError(), last=last, cause=error)
        except httpx.HTTPError as error:
            return _fail_or_retry(APIConnectionError(), last=last, cause=error)
        return _resolve(response, last=last)


class AsyncNegirau:
    """Asynchronous twin of :class:`Negirau` (same surface, ``await``-able)."""

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        """Create a client; ``http_client`` overrides the built-in transport."""
        self._http = http_client or httpx.AsyncClient(
            base_url=base_url, timeout=timeout
        )
        self.max_retries = max_retries
        self.subjects = AsyncSubjects(self)

    async def aclose(self) -> None:
        """Close the underlying HTTP client."""
        await self._http.aclose()

    async def __aenter__(self) -> Self:
        """Support ``async with AsyncNegirau() as client:``."""
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        """Close on context-manager exit."""
        await self.aclose()

    async def get(self, path: str, params: dict[str, str | int | None]) -> object:
        """GET a spec-relative path with retries; returns the parsed JSON body."""
        query = _clean_params(params)
        for attempt in range(self.max_retries + 1):
            result = await self._attempt(path, query, last=attempt == self.max_retries)
            if not isinstance(result, _Retry):
                return result
            await asyncio.sleep(_backoff_seconds(attempt))
        raise AssertionError  # pragma: no cover — the loop always returns or raises

    async def _attempt(self, path: str, query: dict[str, str], *, last: bool) -> object:
        try:
            response = await self._http.get(path, params=query)
        except httpx.TimeoutException as error:
            return _fail_or_retry(APITimeoutError(), last=last, cause=error)
        except httpx.HTTPError as error:
            return _fail_or_retry(APIConnectionError(), last=last, cause=error)
        return _resolve(response, last=last)
