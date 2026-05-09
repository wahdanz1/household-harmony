from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.auth import CurrentUser, verify_household_member
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
async def get_income_defaults(household_id: str, user: CurrentUser):
    """Smart default suggestions for income sources in the user's household."""
    verify_household_member(user.id, household_id)
    try:
        return await service.get_income_suggestions(household_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to compute defaults")


@router.get("/expenses/{household_id}", response_model=List[ExpenseDefaultSuggestion])
async def get_expense_defaults(household_id: str, user: CurrentUser):
    """Smart default suggestions for expenses in the user's household."""
    verify_household_member(user.id, household_id)
    try:
        return await service.get_expense_suggestions(household_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to compute defaults")
