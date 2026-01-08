"""LLM router for invoice parsing and merchant learning."""

import logging
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from app.models.llm import MerchantMapping, ParsedInvoiceResponse
from app.services.llm_service import (
    check_rate_limit,
    parse_invoice,
    save_merchant_mapping,
)

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/parse-invoice", response_model=ParsedInvoiceResponse)
async def parse_invoice_endpoint(
    request: Request,
    file: UploadFile = File(...),
):
    """
    Parse a credit card statement PDF and extract transactions.
    
    Requires Authorization header with Supabase JWT token.
    
    Returns:
        ParsedInvoiceResponse with language, transactions, provider info.
    
    Errors:
        - 401: No user token or no LLM API key configured
        - 413: File too large (max 10MB)
        - 429: Rate limit exceeded (5/minute)
        - 500: Processing error
    """
    logger.info("=== parse_invoice_endpoint called ===")
    
    # Extract user info from request state (set by auth middleware or manually)
    auth_header = request.headers.get("Authorization", "")
    logger.info(f"Auth header present: {bool(auth_header)}")
    
    if not auth_header.startswith("Bearer "):
        logger.warning("Missing or invalid Authorization header")
        raise HTTPException(status_code=401, detail="Authorization required")
    
    # Extract the JWT token for user-scoped Supabase client
    access_token = auth_header.replace("Bearer ", "")
    
    # Get user_id and household_id from query params
    user_id = request.query_params.get("user_id")
    household_id = request.query_params.get("household_id")
    logger.info(f"user_id={user_id}, household_id={household_id}")
    
    if not user_id or not household_id:
        logger.warning("Missing user_id or household_id query params")
        raise HTTPException(
            status_code=400, 
            detail="user_id and household_id query params required"
        )
    
    # Check rate limit
    if check_rate_limit(user_id):
        logger.warning(f"Rate limit exceeded for user {user_id}")
        raise HTTPException(
            status_code=429,
            detail="Upload limit reached (5/minute). Please wait."
        )
    
    # Validate file type
    logger.info(f"File: name={file.filename}, content_type={file.content_type}")
    if file.content_type != "application/pdf":
        logger.warning(f"Invalid file type: {file.content_type}")
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )
    
    # Read file content
    pdf_bytes = await file.read()
    logger.info(f"Read {len(pdf_bytes)} bytes from uploaded file")
    
    # Check file size
    if len(pdf_bytes) > MAX_FILE_SIZE:
        logger.warning(f"File too large: {len(pdf_bytes)} bytes")
        raise HTTPException(
            status_code=413,
            detail="PDF too large (max 10MB)"
        )
    
    try:
        logger.info("Calling parse_invoice service...")
        result = await parse_invoice(pdf_bytes, user_id, household_id)
        logger.info(f"parse_invoice returned {len(result.transactions)} transactions")
        return result
    except ValueError as e:
        # Known errors (no API key, rate limits, etc.)
        error_msg = str(e)
        logger.error(f"ValueError in parse_invoice: {error_msg}")
        
        if "No LLM API key" in error_msg:
            raise HTTPException(status_code=401, detail=error_msg)
        elif "rate limit" in error_msg.lower():
            raise HTTPException(status_code=429, detail=error_msg)
        else:
            raise HTTPException(status_code=500, detail=error_msg)
    except Exception as e:
        # Unexpected errors - log with full traceback
        logger.error(f"Unexpected error in parse_invoice: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process invoice: {str(e)}"
        )


@router.post("/save-merchant-mapping")
async def save_merchant_mapping_endpoint(mapping: MerchantMapping):
    """
    Save a merchant → category mapping for future reference.
    
    This is called after user accepts parsed transactions.
    Helps improve future categorization accuracy.
    """
    logger.info(f"save_merchant_mapping called: {mapping.merchant_name}")
    
    try:
        await save_merchant_mapping(mapping)
        logger.info("Merchant mapping saved successfully")
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to save merchant mapping: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save mapping: {str(e)}"
        )
