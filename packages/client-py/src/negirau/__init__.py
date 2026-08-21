# SPDX-License-Identifier: Apache-2.0
"""Python client for the Negirau public API (read-only, anonymous).

Hand-written around resource namespaces, a ``types``
package, a typed exception hierarchy, retries with backoff — and kept honest
by spec contract tests (tests/test_contract.py).

    from negirau import Negirau

    client = Negirau()
    page = client.subjects.list(q="消防")
"""

from negirau._client import AsyncNegirau, Negirau
from negirau._exceptions import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    BadRequestError,
    InternalServerError,
    NegirauError,
    NotFoundError,
    RateLimitError,
)

__all__ = (
    "APIConnectionError",
    "APIStatusError",
    "APITimeoutError",
    "AsyncNegirau",
    "BadRequestError",
    "InternalServerError",
    "Negirau",
    "NegirauError",
    "NotFoundError",
    "RateLimitError",
)
