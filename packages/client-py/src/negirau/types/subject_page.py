# SPDX-License-Identifier: Apache-2.0
"""Cursor-paginated subject listing."""

from pydantic import BaseModel

from negirau.types.subject import Subject


class SubjectPage(BaseModel):
    """One page of a cursor-paginated subject listing."""

    subjects: list[Subject]
    next_cursor: str | None
