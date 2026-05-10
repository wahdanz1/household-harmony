"""Pydantic models for LLM-powered features."""

from pydantic import BaseModel, Field
from typing import Literal


class Transaction(BaseModel):
    """A single transaction extracted from a credit card statement."""
    date: str = Field(..., description="Transaction date in YYYY-MM-DD format")
    merchant: str = Field(..., description="Merchant or vendor name")
    amount: float = Field(..., description="Transaction amount (positive number)")
    category: str = Field(..., description="Suggested category for the transaction")
    confidence: Literal["HIGH", "MEDIUM", "LOW"] = Field(
        ..., description="Confidence level of the extraction"
    )


class ParsedInvoiceRequest(BaseModel):
    """Internal model for invoice parsing context."""
    user_id: str
    household_id: str


class ParsedInvoiceResponse(BaseModel):
    """Response model for parsed invoice data."""
    language: Literal["Swedish", "English"] = Field(
        ..., description="Detected language of the invoice"
    )
    transactions: list[Transaction] = Field(
        default_factory=list, description="List of extracted transactions"
    )
    provider_used: Literal["groq", "gemini"] = Field(
        ..., description="LLM provider that processed the request"
    )
    duration_ms: int = Field(..., description="Processing time in milliseconds")
    cached: bool = Field(default=False, description="Whether result was from cache")


class MerchantMappingRequest(BaseModel):
    """Client-supplied fields for saving a merchant category mapping."""
    merchant_name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=64)
    household_id: str


class MerchantMapping(BaseModel):
    """Internal model with the resolved user_id."""
    merchant_name: str
    category: str
    user_id: str
    household_id: str


class LLMTransactionResponse(BaseModel):
    """Expected JSON structure from LLM responses."""
    language: Literal["Swedish", "English"]
    transactions: list[Transaction]
