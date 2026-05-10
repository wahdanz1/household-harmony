"""Tests for Swedish tax calculator — 2025 brackets and prognosis logic."""

from decimal import Decimal

import pytest

from app.services.tax_calculator import SwedishTaxCalculator, TaxType


@pytest.fixture
def calc():
    return SwedishTaxCalculator()


# ---------------------------------------------------------------------------
# No-tax (government benefits like Barnbidrag)
# ---------------------------------------------------------------------------

class TestNoTax:
    def test_zero_tax(self, calc):
        result = calc.calculate_monthly_tax(Decimal("1250"), TaxType.NO_TAX)
        assert result["tax"] == Decimal("0")
        assert result["net"] == Decimal("1250")
        assert result["effective_rate"] == Decimal("0")

    def test_zero_income(self, calc):
        result = calc.calculate_monthly_tax(Decimal("0"), TaxType.NO_TAX)
        assert result["tax"] == Decimal("0")
        assert result["net"] == Decimal("0")


# ---------------------------------------------------------------------------
# Standard 30% flat rate
# ---------------------------------------------------------------------------

class TestStandard30:
    def test_basic(self, calc):
        result = calc.calculate_monthly_tax(Decimal("30000"), TaxType.STANDARD_30)
        assert result["tax"] == Decimal("9000")
        assert result["net"] == Decimal("21000")
        assert result["effective_rate"] == Decimal("0.30")

    def test_small_amount(self, calc):
        result = calc.calculate_monthly_tax(Decimal("100"), TaxType.STANDARD_30)
        assert result["tax"] == Decimal("30")
        assert result["net"] == Decimal("70")


# ---------------------------------------------------------------------------
# Progressive Swedish brackets (32% up to 523,200 SEK/year, 52% above)
# ---------------------------------------------------------------------------

class TestProgressive:
    def test_below_bracket(self, calc):
        """40,000/month = 480,000/year — fully in the 32% bracket."""
        result = calc.calculate_monthly_tax(Decimal("40000"), TaxType.PROGRESSIVE)
        expected_annual_tax = Decimal("480000") * Decimal("0.32")
        expected_monthly_tax = expected_annual_tax / 12
        assert result["tax"] == expected_monthly_tax
        assert result["net"] == Decimal("40000") - expected_monthly_tax

    def test_exactly_at_bracket(self, calc):
        """523,200 / 12 = 43,600/month — right at the boundary."""
        monthly = Decimal("523200") / 12
        result = calc.calculate_monthly_tax(monthly, TaxType.PROGRESSIVE)
        expected_tax = Decimal("523200") * Decimal("0.32") / 12
        assert result["tax"] == expected_tax

    def test_above_bracket(self, calc):
        """60,000/month = 720,000/year — crosses into 52% bracket."""
        result = calc.calculate_monthly_tax(Decimal("60000"), TaxType.PROGRESSIVE)
        annual = Decimal("720000")
        tax_low = Decimal("523200") * Decimal("0.32")
        tax_high = (annual - Decimal("523200")) * Decimal("0.52")
        expected_monthly = (tax_low + tax_high) / 12
        assert result["tax"] == expected_monthly

    def test_effective_rate_increases_above_bracket(self, calc):
        below = calc.calculate_monthly_tax(Decimal("40000"), TaxType.PROGRESSIVE)
        above = calc.calculate_monthly_tax(Decimal("60000"), TaxType.PROGRESSIVE)
        assert above["effective_rate"] > below["effective_rate"]
        assert below["effective_rate"] == Decimal("0.32")

    def test_zero_income(self, calc):
        result = calc.calculate_monthly_tax(Decimal("0"), TaxType.PROGRESSIVE)
        assert result["tax"] == Decimal("0")
        assert result["effective_rate"] == Decimal("0")


# ---------------------------------------------------------------------------
# CSN variable rate
# ---------------------------------------------------------------------------

class TestCsnVariable:
    def test_custom_rate(self, calc):
        result = calc.calculate_monthly_tax(
            Decimal("10000"), TaxType.CSN_VARIABLE, custom_rate=Decimal("25")
        )
        assert result["tax"] == Decimal("2500")
        assert result["net"] == Decimal("7500")
        assert result["effective_rate"] == Decimal("0.25")

    def test_zero_rate(self, calc):
        result = calc.calculate_monthly_tax(
            Decimal("10000"), TaxType.CSN_VARIABLE, custom_rate=Decimal("0")
        )
        assert result["tax"] == Decimal("0")
        assert result["net"] == Decimal("10000")

    def test_missing_rate_raises(self, calc):
        with pytest.raises(ValueError, match="Custom tax rate required"):
            calc.calculate_monthly_tax(Decimal("10000"), TaxType.CSN_VARIABLE)


# ---------------------------------------------------------------------------
# Annual prognosis
# ---------------------------------------------------------------------------

class TestAnnualPrognosis:
    def test_owing(self, calc):
        """Employer deducts less than expected — user owes money."""
        result = calc.calculate_annual_prognosis([{
            "gross_monthly": 50000,
            "tax_type": "progressive",
            "tax_deducted": 10000,  # underpaying
        }])
        assert result["status"] == "owing"
        assert result["prognosis"] > 0
        assert "owe" in result["message"]

    def test_refund(self, calc):
        """Employer deducts more than expected — user gets refund."""
        result = calc.calculate_annual_prognosis([{
            "gross_monthly": 30000,
            "tax_type": "progressive",
            "tax_deducted": 15000,  # overpaying
        }])
        assert result["status"] == "refund"
        assert result["prognosis"] < 0
        assert "receive" in result["message"]

    def test_balanced(self, calc):
        """Exact match — no owing or refund."""
        monthly = Decimal("40000")
        annual = monthly * 12
        expected_annual_tax = annual * Decimal("0.32")
        monthly_tax = float(expected_annual_tax / 12)

        result = calc.calculate_annual_prognosis([{
            "gross_monthly": float(monthly),
            "tax_type": "progressive",
            "tax_deducted": monthly_tax,
        }])
        assert result["status"] == "refund"  # 0 is treated as refund (prognosis <= 0)
        assert result["prognosis"] == 0.0
        assert "balanced" in result["message"]

    def test_multiple_sources(self, calc):
        """Two income sources combined for prognosis."""
        result = calc.calculate_annual_prognosis([
            {"gross_monthly": 40000, "tax_type": "progressive", "tax_deducted": 12800},
            {"gross_monthly": 5000, "tax_type": "progressive", "tax_deducted": 1600},
        ])
        assert result["total_gross_annual"] == (40000 + 5000) * 12
        assert result["actual_tax_deducted"] == (12800 + 1600) * 12

    def test_returns_floats(self, calc):
        """API response needs JSON-serializable floats, not Decimals."""
        result = calc.calculate_annual_prognosis([{
            "gross_monthly": 30000,
            "tax_type": "progressive",
            "tax_deducted": 9600,
        }])
        for key in ["expected_annual_tax", "actual_tax_deducted", "prognosis", "total_gross_annual"]:
            assert isinstance(result[key], float)
