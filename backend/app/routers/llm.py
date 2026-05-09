"""LLM router for invoice parsing and merchant learning."""

import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.auth import CurrentUser, verify_household_member
from app.models.llm import MerchantMapping, MerchantMappingRequest, ParsedInvoiceResponse
from app.services.llm_service import (
    check_rate_limit,
    parse_invoice,
    save_merchant_mapping,
)

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/parse-invoice", response_model=ParsedInvoiceResponse)
async def parse_invoice_endpoint(
    user: CurrentUser,
    household_id: str = Form(...),
    file: UploadFile = File(...),
):
    """Parse a credit card statement PDF and extract transactions.

    Errors:
        - 401: missing/invalid auth or no LLM API key configured
        - 404: user is not a member of `household_id`
        - 413: file too large (max 10MB)
        - 429: rate limit exceeded (5/minute)
        - 500: processing error
    """
    verify_household_member(user.id, household_id)

    if check_rate_limit(user.id):
        raise HTTPException(
            status_code=429,
            detail="Upload limit reached (5/minute). Please wait.",
        )

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    pdf_bytes = await file.read()

    if len(pdf_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="PDF too large (max 10MB)")

    try:
        return await parse_invoice(pdf_bytes, user.id, household_id)
    except ValueError as e:
        # Known, user-safe errors (no API key, rate limits, validation).
        error_msg = str(e)
        if "No LLM API key" in error_msg:
            raise HTTPException(status_code=401, detail=error_msg)
        if "rate limit" in error_msg.lower():
            raise HTTPException(status_code=429, detail=error_msg)
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception:
        logger.exception("Unexpected error parsing invoice for user %s", user.id)
        raise HTTPException(status_code=500, detail="Failed to process invoice")


@router.post("/save-merchant-mapping")
async def save_merchant_mapping_endpoint(
    body: MerchantMappingRequest,
    user: CurrentUser,
):
    """Save a merchant -> category mapping for the authenticated user."""
    verify_household_member(user.id, body.household_id)

    try:
        await save_merchant_mapping(
            MerchantMapping(
                merchant_name=body.merchant_name,
                category=body.category,
                user_id=user.id,
                household_id=body.household_id,
            )
        )
        return {"success": True}
    except Exception:
        logger.exception("Failed to save merchant mapping for user %s", user.id)
        raise HTTPException(status_code=500, detail="Failed to save mapping")
