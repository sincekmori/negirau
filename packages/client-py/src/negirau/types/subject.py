# SPDX-License-Identifier: Apache-2.0
"""Subject models."""

from pydantic import BaseModel


class Subject(BaseModel):
    """A recipient of appreciation — a name, optionally with a location."""

    id: str
    name: str
    lat: float | None
    lng: float | None


class NearbySubject(Subject):
    """A subject from a near search, with its distance from the query point."""

    distance_m: int
