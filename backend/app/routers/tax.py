from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.auth import CurrentUser
from app.services.tax_calculator import SwedishTaxCalculator, TaxType

router = APIRouter()
calculator = SwedishTaxCalculator()


class TaxCalculationRequest(BaseModel):
    gross_monthly: float
    tax_type: str
    custom_rate: Optional[float] = None


class TaxCalculationResponse(BaseModel):
    gross: float
    tax: float
    net: float
    effective_rate: float


class IncomeSource(BaseModel):
    gross_monthly: float
    tax_type: str
    custom_rate: Optional[float] = None
    tax_deducted: float = 0.0


class PrognosisRequest(BaseModel):
    income_sources: List[IncomeSource]


class PrognosisResponse(BaseModel):
    expected_annual_tax: float
    actual_tax_deducted: float
    prognosis: float
    status: str
    message: str
    total_gross_annual: float


@router.post("/calculate", response_model=TaxCalculationResponse)
async def calculate_tax(request: TaxCalculationRequest, _user: CurrentUser):
    """Calculate monthly tax for a single income source."""
    try:
        tax_type_enum = TaxType(request.tax_type)
        gross_decimal = Decimal(str(request.gross_monthly))
        custom_rate_decimal = (
            Decimal(str(request.custom_rate)) if request.custom_rate else None
        )

        result = calculator.calculate_monthly_tax(
            gross_decimal,
            tax_type_enum,
            custom_rate_decimal,
        )

        return {
            "gross": float(result["gross"]),
            "tax": float(result["tax"]),
            "net": float(result["net"]),
            "effective_rate": float(result["effective_rate"]),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/prognosis", response_model=PrognosisResponse)
async def calculate_prognosis(request: PrognosisRequest, _user: CurrentUser):
    """Calculate annual tax prognosis based on all income sources."""
    try:
        income_sources_dict = [source.model_dump() for source in request.income_sources]
        return calculator.calculate_annual_prognosis(income_sources_dict)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Prognosis failed")
