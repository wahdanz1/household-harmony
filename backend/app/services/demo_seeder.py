"""Demo data seeder - creates realistic Swedish household with ENCRYPTED data."""

import logging
from app.database import get_supabase_client
from app.services.encryption import encrypt_demo_field

logger = logging.getLogger(__name__)


async def seed_demo_household(user_id: str, dek: bytes) -> str:
    """
    Seed a realistic Swedish household with encrypted sample data.
    
    Args:
        user_id: The demo user's ID
        dek: The raw Data Encryption Key for encrypting sensitive fields
        
    Returns:
        household_id: ID of the created household
    """
    logger.info(f"Starting encrypted demo household seed for user {user_id}")
    supabase = get_supabase_client()
    
    # Helper to encrypt a field
    def enc(value) -> str:
        return encrypt_demo_field(value, dek)
    
    try:
        # 1. Create household
        household_result = supabase.table("households").insert({
            "name": "Janssons Familj",
            "created_by": user_id,
            "currency": "SEK",
            "enable_credit_cards": True,
            "enable_shared_expenses": False  # Disabled by default for demo, user can enable
        }).execute()
        
        household_id = household_result.data[0]["id"]
        logger.info(f"Created household: {household_id}")
        
        # 2. Add user as household member
        supabase.table("household_members").insert({
            "household_id": household_id,
            "user_id": user_id,
            "role": "owner"
        }).execute()
        logger.info("Added household member")
        
        # 3. Create income sources (3 realistic Swedish sources) - ENCRYPTED
        supabase.table("income_sources").insert([
            {
                "household_id": household_id,
                "category": "salary",
                "encrypted_name": enc("Lön (IT-konsult)"),
                "type": "static",
                "encrypted_default_amount": enc(45000),
                "created_by": user_id,
                "is_encrypted": True
            },
            {
                "household_id": household_id,
                "category": "government_benefits",
                "encrypted_name": enc("CSN - Studiestöd"),
                "type": "static",
                "encrypted_default_amount": enc(8500),
                "created_by": user_id,
                "is_encrypted": True
            },
            {
                "household_id": household_id,
                "category": "government_benefits",
                "encrypted_name": enc("Barnbidrag"),
                "type": "static",
                "encrypted_default_amount": enc(1250),
                "created_by": user_id,
                "is_encrypted": True
            }
        ]).execute()
        logger.info("Created encrypted income sources")
        
        # 4. Create expenses (7 realistic Swedish expenses) - ENCRYPTED
        supabase.table("expenses").insert([
            {
                "household_id": household_id,
                "category": "rent",
                "encrypted_name": enc("Hyra"),
                "type": "static",
                "encrypted_default_amount": enc(12000),
                "created_by": user_id,
                "is_encrypted": True
            },
            {
                "household_id": household_id,
                "category": "groceries",
                "encrypted_name": enc("Mat (ICA)"),
                "type": "dynamic",
                "encrypted_default_amount": enc(4500),
                "is_credit": True,
                "created_by": user_id,
                "is_encrypted": True
            },
            {
                "household_id": household_id,
                "category": "electricity",
                "encrypted_name": enc("El"),
                "type": "dynamic",
                "encrypted_default_amount": enc(800),
                "created_by": user_id,
                "is_encrypted": True
            },
            {
                "household_id": household_id,
                "category": "internet",
                "encrypted_name": enc("Internet"),
                "type": "static",
                "encrypted_default_amount": enc(349),
                "created_by": user_id,
                "is_encrypted": True
            },
            {
                "household_id": household_id,
                "category": "phone_plan",
                "encrypted_name": enc("Mobilabonnemang"),
                "type": "static",
                "encrypted_default_amount": enc(299),
                "created_by": user_id,
                "is_encrypted": True
            },
            {
                "household_id": household_id,
                "category": "other",
                "encrypted_name": enc("SL-kort"),
                "type": "static",
                "encrypted_default_amount": enc(990),
                "created_by": user_id,
                "is_encrypted": True
            },
            {
                "household_id": household_id,
                "category": "fuel",
                "encrypted_name": enc("Bensin"),
                "type": "dynamic",
                "encrypted_default_amount": enc(1500),
                "is_credit": True,
                "created_by": user_id,
                "is_encrypted": True
            }
        ]).execute()
        logger.info("Created encrypted expenses")
        
        # 4.5. Get income_sources and expenses IDs for creating monthly records
        income_sources_result = supabase.table("income_sources")\
            .select("id, encrypted_default_amount")\
            .eq("household_id", household_id)\
            .execute()
        
        expenses_result = supabase.table("expenses")\
            .select("id, encrypted_default_amount")\
            .eq("household_id", household_id)\
            .execute()
        
        # Calculate current month dates
        from datetime import date
        today = date.today()
        # Financial month from 25th to 24th (default)
        if today.day >= 25:
            month_start = date(today.year, today.month, 25)
            if today.month == 12:
                month_end = date(today.year + 1, 1, 24)
            else:
                month_end = date(today.year, today.month + 1, 24)
        else:
            if today.month == 1:
                month_start = date(today.year - 1, 12, 25)
            else:
                month_start = date(today.year, today.month - 1, 25)
            month_end = date(today.year, today.month, 24)
        
        month_str = month_start.strftime("%Y-%m")
        month_date = month_start.isoformat()  # Proper date format for database
        
        # Create monthly_incomes records for Dashboard
        monthly_incomes = []
        for source in income_sources_result.data:
            monthly_incomes.append({
                "income_source_id": source["id"],
                "household_id": household_id,
                "month": month_date,  # Use ISO date format
                "month_start": month_start.isoformat(),
                "month_end": month_end.isoformat(),
                "encrypted_amount": source["encrypted_default_amount"],  # Use same encrypted value
                "created_by": user_id,
                "is_encrypted": True
            })
        
        if monthly_incomes:
            supabase.table("monthly_incomes").insert(monthly_incomes).execute()
            logger.info(f"Created {len(monthly_incomes)} monthly_incomes records")
        
        # Create monthly_expenses records for Dashboard
        monthly_expenses = []
        for expense in expenses_result.data:
            monthly_expenses.append({
                "expense_id": expense["id"],
                "household_id": household_id,
                "month": month_date,  # Use ISO date format
                "month_start": month_start.isoformat(),
                "month_end": month_end.isoformat(),
                "encrypted_amount": expense["encrypted_default_amount"],  # Use same encrypted value
                "created_by": user_id,
                "is_encrypted": True
            })
        
        if monthly_expenses:
            supabase.table("monthly_expenses").insert(monthly_expenses).execute()
            logger.info(f"Created {len(monthly_expenses)} monthly_expenses records")
        
        # 5. Create subscriptions - ENCRYPTED
        supabase.table("subscriptions").insert([
            {
                "household_id": household_id,
                "encrypted_name": enc("Netflix"),
                "encrypted_amount": enc(179),
                "billing_cycle": "monthly",
                "category": "streaming",
                "created_by": user_id,
                "is_encrypted": True
            },
            {
                "household_id": household_id,
                "encrypted_name": enc("Spotify Family"),
                "encrypted_amount": enc(189),
                "billing_cycle": "monthly",
                "category": "music",
                "created_by": user_id,
                "is_encrypted": True
            }
        ]).execute()
        logger.info("Created encrypted subscriptions")
        
        # 6. Create credit card - ENCRYPTED
        supabase.table("credit_cards").insert({
            "household_id": household_id,
            "encrypted_name": enc("SEB Mastercard"),
            "encrypted_monthly_limit": enc(8000),
            "created_by": user_id,
            "is_encrypted": True
        }).execute()
        logger.info("Created encrypted credit card")
        
        # 7. Create savings goal - ENCRYPTED
        supabase.table("savings_goals").insert({
            "household_id": household_id,
            "encrypted_name": enc("Semester i Italien"),
            "encrypted_target_amount": enc(25000),
            "encrypted_current_amount": enc(8500),
            "monthly_contribution": 2000,
            "priority": "high",
            "goal_type": "household",
            "created_by": user_id,
            "is_encrypted": True
        }).execute()
        logger.info("Created encrypted savings goal")
        
        logger.info(f"Encrypted demo household seeding complete: {household_id}")
        return household_id
        
    except Exception as e:
        logger.error(f"Demo seeding failed: {e}", exc_info=True)
        raise Exception(f"Failed to seed demo household: {str(e)}")
