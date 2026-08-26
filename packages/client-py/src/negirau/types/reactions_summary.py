# SPDX-License-Identifier: Apache-2.0
"""Reaction summary models."""

from pydantic import BaseModel

from negirau.types.display_value import DisplayValue


class ReactionsSummary(BaseModel):
    """All-time reaction display values for one subject."""

    id: str
    total: DisplayValue
    by_type: dict[str, DisplayValue]
