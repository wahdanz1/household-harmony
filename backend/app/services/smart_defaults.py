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
        
        Static sources: Return last month's value
        Variable sources: Return 3-month average
        """
        # Fetch all income sources for household
        response = self.db.from_("income_sources")\
            .select("*")\
            .eq("household_id", household_id)\
            .eq("is_active", True)\
            .execute()
        
        sources = response.data
        suggestions = []
        
        for source in sources:
            if source["type"] == "static":
                # Use PostgreSQL function for latest amount
                result = self.db.rpc("get_latest_income_amount", {
                    "p_household_id": household_id,
                    "p_income_source_id": source["id"]
                }).execute()
                
                suggested_amount = result.data if result.data else source["default_amount"]
            
            else:  # variable
                # Use PostgreSQL function for 3-month average
                result = self.db.rpc("calculate_income_average", {
                    "p_household_id": household_id,
                    "p_income_source_id": source["id"],
                    "p_months": 3
                }).execute()
                
                suggested_amount = result.data if result.data else source["default_amount"]
            
            suggestions.append({
                "id": source["id"],
                "name": source["name"],
                "type": source["type"],
                "suggested_amount": float(suggested_amount) if suggested_amount else 0.0,
                "default_amount": float(source["default_amount"])
            })
        
        return suggestions
    
    async def get_expense_suggestions(self, household_id: str) -> List[Dict]:
        """
        Get suggested expense amounts based on category type.
        
        Static categories: Return last month's value
        Dynamic categories: Return 3-month average
        """
        # Fetch all expense categories for household
        response = self.db.from_("regular_expenses")\
            .select("*")\
            .eq("household_id", household_id)\
            .eq("is_active", True)\
            .execute()
        
        categories = response.data
        suggestions = []
        
        for category in categories:
            if category["type"] == "static":
                # Use PostgreSQL function for latest amount
                result = self.db.rpc("get_latest_expense_amount", {
                    "p_household_id": household_id,
                    "p_regular_expense_id": category["id"]
                }).execute()
                
                suggested_amount = result.data if result.data else category["default_amount"]
            
            else:  # dynamic
                # Use PostgreSQL function for 3-month average
                result = self.db.rpc("calculate_expense_average", {
                    "p_household_id": household_id,
                    "p_regular_expense_id": category["id"],
                    "p_months": 3
                }).execute()
                
                suggested_amount = result.data if result.data else category["default_amount"]
            
            suggestions.append({
                "id": category["id"],
                "name": category["name"],
                "type": category["type"],
                "category": category.get("category", "other"),
                "suggested_amount": float(suggested_amount) if suggested_amount else 0.0,
                "default_amount": float(category["default_amount"])
            })
        
        return suggestions
