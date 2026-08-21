# SPDX-License-Identifier: Apache-2.0
"""Reaction summary models."""

from pydantic import BaseModel

from negirau.types.display_value import DisplayValue


class ReactionsSummary(BaseModel):
    """Reaction display values for one subject over a period."""

    id: str
    period: str
    total: DisplayValue
    by_type: dict[str, DisplayValue]
