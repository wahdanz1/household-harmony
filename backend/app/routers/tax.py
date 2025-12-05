from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal
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
async def calculate_tax(request: TaxCalculationRequest):
    """
    Calculate monthly tax for a single income source.
    
    Tax types:
    - no_tax: No taxation (e.g. Barnbidrag)
    - standard_30: 30% flat rate (e.g. UA Kommun)
    - progressive: Swedish progressive brackets (32%/52%)
    - csn_variable: Custom rate (requires custom_rate)
    """
    try:
        tax_type_enum = TaxType(request.tax_type)
        gross_decimal = Decimal(str(request.gross_monthly))
        custom_rate_decimal = Decimal(str(request.custom_rate)) if request.custom_rate else None
        
        result = calculator.calculate_monthly_tax(
            gross_decimal,
            tax_type_enum,
            custom_rate_decimal
        )
        
        return {
            "gross": float(result["gross"]),
            "tax": float(result["tax"]),
            "net": float(result["net"]),
            "effective_rate": float(result["effective_rate"])
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/prognosis", response_model=PrognosisResponse)
async def calculate_prognosis(request: PrognosisRequest):
    """
    Calculate annual tax prognosis based on all income sources.
    
    Returns expected tax, actual deductions, and whether you'll owe or receive a refund.
    """
    try:
        income_sources_dict = [source.model_dump() for source in request.income_sources]
        result = calculator.calculate_annual_prognosis(income_sources_dict)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
