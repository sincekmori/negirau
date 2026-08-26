# SPDX-License-Identifier: Apache-2.0
"""The ``subjects`` resource (``client.subjects.list()`` etc.)."""

from __future__ import annotations

from typing import TYPE_CHECKING
from urllib.parse import quote

from pydantic import BaseModel

from negirau.types import (
    NearbySubject,
    ReactionsSummary,
    Subject,
    SubjectPage,
)

if TYPE_CHECKING:
    import builtins

    from negirau._client import AsyncNegirau, Negirau


class _NearbyPage(BaseModel):
    """Internal: the near-search response shape (no cursor, distances included)."""

    subjects: list[NearbySubject]


def _subject_path(subject_id: str, suffix: str = "") -> str:
    """Path for one subject, with the id percent-encoded."""
    return f"/subjects/{quote(subject_id, safe='')}{suffix}"


class Reactions:
    """Sub-resource: ``client.subjects.reactions.retrieve(subject_id)``."""

    def __init__(self, client: Negirau) -> None:
        """Bind to the owning client."""
        self._client = client

    def retrieve(self, subject_id: str) -> ReactionsSummary:
        """All-time reaction display values for a subject."""
        payload = self._client.get(_subject_path(subject_id, "/reactions"), {})
        return ReactionsSummary.model_validate(payload)


class Subjects:
    """The recipients of appreciation."""

    def __init__(self, client: Negirau) -> None:
        """Bind to the owning client and expose sub-resources."""
        self._client = client
        self.reactions = Reactions(client)

    def list(
        self,
        *,
        q: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> SubjectPage:
        """List/search subjects (cursor-paginated).

        ``q`` is free-text name search: 1-2 characters match as a name
        prefix (single page), 3+ anywhere in the name.
        """
        payload = self._client.get(
            "/subjects",
            {"q": q, "limit": limit, "cursor": cursor},
        )
        return SubjectPage.model_validate(payload)

    def list_near(
        self,
        lat: float,
        lng: float,
        *,
        radius: int | None = None,
        limit: int | None = None,
    ) -> builtins.list[NearbySubject]:
        """Find spatial subjects near a point, closest first (radius in meters)."""
        payload = self._client.get(
            "/subjects", {"near": f"{lat},{lng}", "radius": radius, "limit": limit}
        )
        return _NearbyPage.model_validate(payload).subjects

    def retrieve(self, subject_id: str) -> Subject:
        """Fetch one subject by its public identifier."""
        payload = self._client.get(_subject_path(subject_id), {})
        return Subject.model_validate(payload)


class AsyncReactions:
    """Async twin of :class:`Reactions`."""

    def __init__(self, client: AsyncNegirau) -> None:
        """Bind to the owning client."""
        self._client = client

    async def retrieve(self, subject_id: str) -> ReactionsSummary:
        """All-time reaction display values for a subject."""
        payload = await self._client.get(_subject_path(subject_id, "/reactions"), {})
        return ReactionsSummary.model_validate(payload)


class AsyncSubjects:
    """Async twin of :class:`Subjects`."""

    def __init__(self, client: AsyncNegirau) -> None:
        """Bind to the owning client and expose sub-resources."""
        self._client = client
        self.reactions = AsyncReactions(client)

    async def list(
        self,
        *,
        q: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> SubjectPage:
        """List/search subjects (cursor-paginated).

        ``q`` is free-text name search: 1-2 characters match as a name
        prefix (single page), 3+ anywhere in the name.
        """
        payload = await self._client.get(
            "/subjects",
            {"q": q, "limit": limit, "cursor": cursor},
        )
        return SubjectPage.model_validate(payload)

    async def list_near(
        self,
        lat: float,
        lng: float,
        *,
        radius: int | None = None,
        limit: int | None = None,
    ) -> builtins.list[NearbySubject]:
        """Find spatial subjects near a point, closest first (radius in meters)."""
        payload = await self._client.get(
            "/subjects", {"near": f"{lat},{lng}", "radius": radius, "limit": limit}
        )
        return _NearbyPage.model_validate(payload).subjects

    async def retrieve(self, subject_id: str) -> Subject:
        """Fetch one subject by its public identifier."""
        payload = await self._client.get(_subject_path(subject_id), {})
        return Subject.model_validate(payload)
