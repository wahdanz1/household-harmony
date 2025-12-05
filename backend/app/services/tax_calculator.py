from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional


class TaxType(str, Enum):
    """Swedish tax category types."""
    NO_TAX = "no_tax"
    STANDARD_30 = "standard_30"
    PROGRESSIVE = "progressive"
    CSN_VARIABLE = "csn_variable"


class SwedishTaxCalculator:
    """Calculate Swedish income tax according to 2025 tax brackets."""
    
    # Swedish tax brackets 2025
    BRACKET_LOW = Decimal("523200")  # SEK annually
    RATE_LOW = Decimal("0.32")       # 32% up to bracket
    RATE_HIGH = Decimal("0.52")      # 52% above bracket
    
    def calculate_monthly_tax(
        self,
        gross_monthly: Decimal,
        tax_type: TaxType,
        custom_rate: Optional[Decimal] = None
    ) -> Dict[str, Decimal]:
        """
        Calculate monthly tax based on type.
        
        Args:
            gross_monthly: Gross monthly income in SEK
            tax_type: Type of taxation
            custom_rate: Custom tax rate (percentage, 0-100) for CSN variable
        
        Returns:
            Dict with gross, tax, net, and effective_rate
        """
        if tax_type == TaxType.NO_TAX:
            return {
                "gross": gross_monthly,
                "tax": Decimal("0"),
                "net": gross_monthly,
                "effective_rate": Decimal("0")
            }
        
        elif tax_type == TaxType.STANDARD_30:
            tax = gross_monthly * Decimal("0.30")
            return {
                "gross": gross_monthly,
                "tax": tax,
                "net": gross_monthly - tax,
                "effective_rate": Decimal("0.30")
            }
        
        elif tax_type == TaxType.PROGRESSIVE:
            # Calculate based on annual income
            annual_gross = gross_monthly * 12
            
            if annual_gross <= self.BRACKET_LOW:
                annual_tax = annual_gross * self.RATE_LOW
            else:
                tax_low = self.BRACKET_LOW * self.RATE_LOW
                tax_high = (annual_gross - self.BRACKET_LOW) * self.RATE_HIGH
                annual_tax = tax_low + tax_high
            
            monthly_tax = annual_tax / 12
            return {
                "gross": gross_monthly,
                "tax": monthly_tax,
                "net": gross_monthly - monthly_tax,
                "effective_rate": monthly_tax / gross_monthly if gross_monthly > 0 else Decimal("0")
            }
        
        elif tax_type == TaxType.CSN_VARIABLE:
            if custom_rate is None:
                raise ValueError("Custom tax rate required for CSN variable taxation")
            
            rate = custom_rate / 100  # Convert percentage to decimal
            tax = gross_monthly * rate
            return {
                "gross": gross_monthly,
                "tax": tax,
                "net": gross_monthly - tax,
                "effective_rate": rate
            }
        
        else:
            raise ValueError(f"Unknown tax type: {tax_type}")
    
    def calculate_annual_prognosis(
        self,
        income_sources: List[Dict]
    ) -> Dict:
        """
        Calculate yearly tax prognosis based on all income sources.
        
        Args:
            income_sources: List of dicts with:
                - gross_monthly: Monthly gross income
                - tax_type: Tax type
                - custom_rate: Optional custom rate
                - tax_deducted: Actual tax deducted by employer
        
        Returns:
            Dict with expected_tax, actual_deducted, prognosis, status, message
        """
        total_gross_annual = Decimal("0")
        total_tax_deducted = Decimal("0")
        
        for source in income_sources:
            gross_monthly = Decimal(str(source["gross_monthly"]))
            tax_deducted = Decimal(str(source.get("tax_deducted", 0)))
            
            total_gross_annual += gross_monthly * 12
            total_tax_deducted += tax_deducted * 12
        
        # Calculate expected tax using progressive brackets
        if total_gross_annual <= self.BRACKET_LOW:
            expected_tax = total_gross_annual * self.RATE_LOW
        else:
            tax_low = self.BRACKET_LOW * self.RATE_LOW
            tax_high = (total_gross_annual - self.BRACKET_LOW) * self.RATE_HIGH
            expected_tax = tax_low + tax_high
        
        prognosis = expected_tax - total_tax_deducted
        
        status = "owing" if prognosis > 0 else "refund"
        abs_prognosis = abs(prognosis)
        
        if prognosis > 0:
            message = f"You will likely owe ~{int(abs_prognosis):,} SEK on your tax declaration"
        elif prognosis < 0:
            message = f"You will likely receive ~{int(abs_prognosis):,} SEK back on your tax declaration"
        else:
            message = "Your tax deductions are balanced"
        
        return {
            "expected_annual_tax": float(expected_tax),
            "actual_tax_deducted": float(total_tax_deducted),
            "prognosis": float(prognosis),
            "status": status,
            "message": message,
            "total_gross_annual": float(total_gross_annual)
        }
