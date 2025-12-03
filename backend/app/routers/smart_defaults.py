from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.services.smart_defaults import SmartDefaultsService


router = APIRouter()
service = SmartDefaultsService()


class DefaultSuggestion(BaseModel):
    id: str
    name: str
    type: str
    suggested_amount: float
    default_amount: float


class ExpenseDefaultSuggestion(DefaultSuggestion):
    category: str


@router.get("/income/{household_id}", response_model=List[DefaultSuggestion])
async def get_income_defaults(household_id: str):
    """
    Get smart default suggestions for income sources.
    
    - Static income: Returns last month's value
    - Variable income: Returns 3-month rolling average
    """
    try:
        suggestions = await service.get_income_suggestions(household_id)
        return suggestions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/expenses/{household_id}", response_model=List[ExpenseDefaultSuggestion])
async def get_expense_defaults(household_id: str):
    """
    Get smart default suggestions for expenses.
    
    - Static expenses: Returns last month's value
    - Dynamic expenses: Returns 3-month rolling average
    """
    try:
        suggestions = await service.get_expense_suggestions(household_id)
        return suggestions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
