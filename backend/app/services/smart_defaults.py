from typing import List, Dict
from decimal import Decimal
from app.database import get_supabase_client


class SmartDefaultsService:
    """Calculate smart default values for income and expenses."""
    
    def __init__(self):
        self.db = get_supabase_client()
    
    async def get_income_suggestions(self, household_id: str) -> List[Dict]:
        """
        Get suggested income amounts based on source type.
        
        TEMPORARILY DISABLED: Backend queries plaintext columns (name, default_amount)
        that were dropped during encryption migration. Needs to be rewritten for encrypted fields.
        """
        # TODO: Rewrite to use encrypted_name, encrypted_default_amount
        return []
    
    async def get_expense_suggestions(self, household_id: str) -> List[Dict]:
        """
        Get suggested expense amounts based on category type.
        
        TEMPORARILY DISABLED: Backend queries plaintext columns  
        that were dropped during encryption migration. Needs to be rewritten for encrypted fields.
        """
        # TODO: Rewrite for new expenses table schema
        return []
