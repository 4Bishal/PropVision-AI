"""Public request contracts; aliases preserve the notebook's raw column names."""
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
PositiveInt = Annotated[int, Field(strict=True, ge=1)]
Binary = Annotated[int, Field(strict=True, ge=0, le=1)]


class InputModel(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class PredictionInput(InputModel):
    property_type: Text
    sector: Text
    bedRoom: PositiveInt
    bathroom: PositiveInt
    balcony: Text
    agePossession: Text
    built_up_area: float = Field(gt=0, strict=True)
    servant_room: Binary = Field(alias='servant room')
    store_room: Binary = Field(alias='store room')
    furnishing_type: Text
    floor_category: Text
    luxury_category: Text


class ValuationRange(BaseModel):
    q90_residual: float = Field(allow_inf_nan=False)
    lower_bound: float = Field(ge=0, allow_inf_nan=False)
    upper_bound: float = Field(ge=0, allow_inf_nan=False)
    confidence_level: str
    mae_pct: float = Field(ge=0, allow_inf_nan=False)


class PredictionOutput(BaseModel):
    predicted_price: float
    valuation_range: ValuationRange | None = None
    predicted_price_inr: float
    formatted_price: str
    log_prediction: float


class SimilarInput(InputModel):
    property_id: Annotated[int, Field(strict=True, ge=0)] | Text
    top_n: Annotated[int, Field(strict=True, ge=1, le=100)] = 6
    max_price_diff_pct: float = Field(default=0.35, ge=0)


class ContextualInput(InputModel):
    # Price and hard budget bounds are in INR; area is square feet.
    sector: Text | None = None
    price: float | None = Field(default=None, gt=0)
    bedRoom: PositiveInt | None = None
    built_up_area: float | None = Field(default=None, gt=0)
    luxury_category: Text | None = None
    budget: float | None = Field(default=None, gt=0)
    min_price: float | None = Field(default=None, gt=0)
    max_price: float | None = Field(default=None, gt=0)
    top_n: Annotated[int, Field(strict=True, ge=1, le=100)] = 6
