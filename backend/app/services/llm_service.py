"""LLM service for invoice parsing with multi-provider support."""

import asyncio
import hashlib
import io
import json
import logging
import time
from typing import Optional

import httpx
import pdfplumber

from app.database import get_supabase_client
from app.models.llm import (
    LLMTransactionResponse,
    MerchantMapping,
    ParsedInvoiceResponse,
    Transaction,
)

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# In-memory cache for parsed results (TTL: 5 minutes). Keyed by
# (user_id, sha256(pdf)) so two users uploading the same document do not
# share parsed transactions or any leaked merchant context.
_response_cache: dict[str, tuple[ParsedInvoiceResponse, float]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes
_CACHE_MAX_ENTRIES = 1_000  # bound memory growth

# Rate limiter: track requests per user
_rate_limiter: dict[str, list[float]] = {}
RATE_LIMIT_WINDOW = 60  # 1 minute
RATE_LIMIT_MAX = 5  # 5 requests per minute

# PDF extraction limits — bound CPU/memory exposure to malformed or
# decompression-bomb PDFs. The 10 MB upload cap doesn't bound page count or
# extraction time on its own.
PDF_MAX_PAGES = 50
PDF_EXTRACT_TIMEOUT_SECONDS = 30


def _get_cache_key(pdf_bytes: bytes, user_id: str) -> str:
    """Generate a per-user cache key from PDF content hash."""
    digest = hashlib.sha256(pdf_bytes).hexdigest()
    return f"{user_id}:{digest}"


def _check_cache(cache_key: str) -> Optional[ParsedInvoiceResponse]:
    """Check if a cached response exists and is still valid."""
    if cache_key in _response_cache:
        response, timestamp = _response_cache[cache_key]
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            logger.info(f"Cache hit for key {cache_key[:16]}...")
            return ParsedInvoiceResponse(
                language=response.language,
                transactions=response.transactions,
                provider_used=response.provider_used,
                duration_ms=0,
                cached=True,
            )
        else:
            del _response_cache[cache_key]
    return None


def _set_cache(cache_key: str, response: ParsedInvoiceResponse) -> None:
    """Store response in cache, evicting the oldest entry if at capacity."""
    if cache_key not in _response_cache and len(_response_cache) >= _CACHE_MAX_ENTRIES:
        oldest = min(_response_cache.items(), key=lambda kv: kv[1][1])
        _response_cache.pop(oldest[0], None)
    _response_cache[cache_key] = (response, time.time())


def check_rate_limit(user_id: str) -> bool:
    """Check if user has exceeded rate limit."""
    now = time.time()
    
    if user_id not in _rate_limiter:
        _rate_limiter[user_id] = []
    
    _rate_limiter[user_id] = [
        t for t in _rate_limiter[user_id] 
        if now - t < RATE_LIMIT_WINDOW
    ]
    
    if len(_rate_limiter[user_id]) >= RATE_LIMIT_MAX:
        logger.warning(f"Rate limit exceeded for user {user_id}")
        return True
    
    _rate_limiter[user_id].append(now)
    return False


def _extract_text_sync(pdf_bytes: bytes) -> str:
    """Blocking PDF text extraction. Runs inside a worker thread."""
    text_parts: list[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)
        if page_count > PDF_MAX_PAGES:
            raise ValueError(
                f"PDF has too many pages ({page_count}). Maximum is {PDF_MAX_PAGES}."
            )
        logger.info("PDF has %d pages", page_count)
        for i, page in enumerate(pdf.pages):
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
                logger.info("Page %d: extracted %d chars", i + 1, len(page_text))
    return "\n".join(text_parts)


async def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from a PDF with a hard time + page budget.

    pdfplumber is CPU-bound and blocking, so we run it in a worker thread and
    cancel after `PDF_EXTRACT_TIMEOUT_SECONDS`. This caps both DoS exposure
    (decompression bombs, pathological PDFs) and the impact on the event loop.
    """
    logger.info("Extracting text from PDF (%d bytes)", len(pdf_bytes))
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_extract_text_sync, pdf_bytes),
            timeout=PDF_EXTRACT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.warning("PDF extraction timed out after %ds", PDF_EXTRACT_TIMEOUT_SECONDS)
        raise ValueError("PDF took too long to process. Try a smaller or simpler file.")
    except ValueError:
        # User-safe message (e.g. page-count cap). Re-raise as-is.
        raise
    except Exception:
        logger.exception("PDF extraction failed")
        raise ValueError("Could not read this PDF. It may be corrupt or unsupported.")

    logger.info("Total extracted text: %d chars", len(result))
    return result


async def get_user_llm_config(user_id: str) -> Optional[dict]:
    """Fetch user's LLM provider configuration from database."""
    from app.services.encryption import decrypt_api_key
    
    logger.info(f"Fetching LLM config for user {user_id}")
    
    try:
        supabase = get_supabase_client()
        
        # Fetch all keys, ordered by most recently updated
        # SECURITY: Always filter by user_id (verified at endpoint level)
        result = supabase.table("user_api_keys").select(
            "provider, encrypted_key, is_encrypted"
        ).eq("user_id", user_id).order(
            "updated_at", desc=True
        ).execute()
        
        logger.info(f"Query returned {len(result.data) if result.data else 0} keys")
        
        if not result or not result.data or len(result.data) == 0:
            logger.warning(f"No API key found for user {user_id}")
            return None
        
        # Use the most recently updated key
        data = result.data[0]
        encrypted_key = data.get("encrypted_key")
        is_encrypted = data.get("is_encrypted", False)
        
        if not encrypted_key:
            logger.warning(f"API key is empty for user {user_id}")
            return None
        
        # Decrypt the API key if it's encrypted with backend master key
        if is_encrypted:
            try:
                api_key = decrypt_api_key(encrypted_key)
                logger.info("Successfully decrypted API key")
            except ValueError as e:
                logger.error(f"Failed to decrypt API key: {e}")
                raise ValueError("Failed to decrypt API key. It may have been saved with a different encryption key.")
        else:
            # Legacy unencrypted key (migration case)
            api_key = encrypted_key
            logger.warning("Using unencrypted API key (legacy)")
        
        provider = data.get("provider", "gemini")
        logger.info(f"Found LLM config: provider={provider}, key_length={len(api_key)}")
        
        return {
            "provider": provider,
            "api_key": api_key,
        }
    except Exception as e:
        logger.error(f"Failed to fetch LLM config: {e}", exc_info=True)
        raise


async def get_merchant_learnings(user_id: str, household_id: str) -> list[dict]:
    """Fetch user's previous merchant -> category mappings."""
    logger.info(f"Fetching merchant learnings for user {user_id}")
    
    try:
        supabase = get_supabase_client()
        
        # SECURITY: Always filter by user_id and household_id
        result = supabase.table("merchant_categories").select(
            "merchant_name, category, times_used"
        ).eq("user_id", user_id).eq("household_id", household_id).order(
            "times_used", desc=True
        ).limit(20).execute()
        
        learnings = result.data if result else []
        logger.info(f"Found {len(learnings)} merchant learnings")
        return learnings
    except Exception as e:
        logger.error(f"Failed to fetch merchant learnings: {e}", exc_info=True)
        # Non-critical, return empty list
        return []


def _build_extraction_prompt(text: str, learnings: list[dict]) -> str:
    """Build the LLM prompt with extracted text and merchant learnings."""
    learning_context = ""
    if learnings:
        mappings = [f"- {m['merchant_name']} -> {m['category']}" for m in learnings]
        learning_context = f"""
User's previous categorizations (use as guidance for similar merchants):
{chr(10).join(mappings)}
"""
    
    # Valid category IDs matching frontend EXPENSE_CATEGORIES
    valid_categories = [
        "rent", "internet", "phone_plan", "electricity", "groceries",
        "dining_out", "entertainment", "shopping", "fuel", "travel",
        "car_repairs", "credit_card", "healthcare", "other"
    ]
    
    return f"""You are a financial document parser. Extract credit card transactions from the following text.

{learning_context}

TASK:
1. Identify the language (Swedish or English)
2. Extract all transactions with: date, merchant, amount, category, confidence

VALID CATEGORIES (use exact values):
- groceries: ONLY dedicated supermarkets/food stores (ICA, Coop, Willys, Hemkop, Lidl)
- dining_out: restaurants, cafes, fast food, takeaway
- shopping: clothing stores, retail, department stores, general merchandise
- entertainment: movies, streaming, games, hobbies, events
- fuel: gas stations only
- travel: flights, hotels, train tickets, vacation bookings
- healthcare: pharmacies (Apotek), doctors, clinics, hospitals
- rent, internet, phone_plan, electricity: utility bills only
- car_repairs: actual repair shops/mechanics only
- other: use when no category clearly fits

CONFIDENCE RULES:
- HIGH: If the merchant EXACTLY MATCHES or is a clear variation of a merchant in "User's previous categorizations".
- HIGH: For obvious nationwide chains (ICA, Coop, Circle K, Apotek).
- MEDIUM: General stores (Biltema, Clas Ohlson, Amazon) where category depends on purchase.
- MEDIUM: When "other" is selected.
- LOW: Unfamiliar merchant names or truly ambiguous purchases.

IMPORTANT:
- Use the "User's previous categorizations" list as the primary source of truth.
- Biltema, Clas Ohlson, JULA = "shopping" (unless learnt otherwise).
- Stadium = "shopping".
- IGNORE: payment rows, summaries, interest, credit limits, balance lines.

RETURN ONLY VALID JSON:
{{
  "language": "Swedish" | "English",
  "transactions": [
    {{"date": "YYYY-MM-DD", "merchant": "string", "amount": number, "category": "string", "confidence": "HIGH"|"MEDIUM"|"LOW"}}
  ]
}}

TEXT START:
{text}
TEXT END."""


async def call_groq(text: str, api_key: str, learnings: list[dict]) -> LLMTransactionResponse:
    """Call Groq API with structured JSON output."""
    logger.info(f"Calling Groq API with {len(text)} chars of text")
    prompt = _build_extraction_prompt(text, learnings)
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                },
            )
            
            logger.info(f"Groq response status: {response.status_code}")
            
            if response.status_code == 429:
                raise ValueError("Groq rate limit reached. Please wait and try again.")
            
            if response.status_code != 200:
                error_body = response.text
                logger.error(f"Groq API error response: {error_body}")
                error_detail = response.json().get("error", {}).get("message", "Unknown error")
                raise ValueError(f"Groq API error: {error_detail}")
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            logger.info(f"Groq returned {len(content)} chars of content")
            
            parsed = json.loads(content)
            logger.info(f"Parsed {len(parsed.get('transactions', []))} transactions from Groq response")
            return LLMTransactionResponse(**parsed)
    except httpx.RequestError as e:
        logger.error(f"Groq request failed: {e}", exc_info=True)
        raise ValueError(f"Failed to connect to Groq API: {e}")
    except Exception as e:
        logger.error(f"Groq call failed: {e}", exc_info=True)
        raise


async def call_gemini(text: str, api_key: str, learnings: list[dict]) -> LLMTransactionResponse:
    """Call Gemini API with structured JSON output."""
    logger.info(f"Calling Gemini API with {len(text)} chars of text")
    prompt = _build_extraction_prompt(text, learnings)
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "response_mime_type": "application/json",
                    },
                },
            )
            
            logger.info(f"Gemini response status: {response.status_code}")
            
            if response.status_code == 429:
                raise ValueError("Gemini rate limit reached (20/day). Wait until tomorrow or upgrade to paid tier.")
            
            if response.status_code == 503:
                raise ValueError("Gemini is currently overloaded. Please try again in a few minutes.")
            
            if response.status_code != 200:
                error_body = response.text
                logger.error(f"Gemini API error response: {error_body}")
                error_detail = response.json().get("error", {}).get("message", "Unknown error")
                raise ValueError(f"Gemini API error: {error_detail}")
            
            result = response.json()
            content = result["candidates"][0]["content"]["parts"][0]["text"]
            content = content.replace("```json", "").replace("```", "").strip()
            logger.info(f"Gemini returned {len(content)} chars of content")
            
            parsed = json.loads(content)
            logger.info(f"Parsed {len(parsed.get('transactions', []))} transactions from Gemini response")
            return LLMTransactionResponse(**parsed)
    except httpx.RequestError as e:
        logger.error(f"Gemini request failed: {e}", exc_info=True)
        raise ValueError(f"Failed to connect to Gemini API: {e}")
    except Exception as e:
        logger.error(f"Gemini call failed: {e}", exc_info=True)
        raise


async def parse_invoice(
    pdf_bytes: bytes,
    user_id: str,
    household_id: str,
) -> ParsedInvoiceResponse:
    """Main orchestrator for invoice parsing."""
    logger.info(f"=== START parse_invoice for user {user_id} ===")
    start_time = time.time()
    
    try:
        # 1. Check cache (per-user key — two users uploading the same PDF
        #    must not share parsed results)
        cache_key = _get_cache_key(pdf_bytes, user_id)
        cached = _check_cache(cache_key)
        if cached:
            logger.info("Returning cached response")
            return cached
        
        # 2. Extract text
        logger.info("Step 2: Extracting text from PDF")
        text = await extract_text_from_pdf(pdf_bytes)
        if not text.strip():
            raise ValueError("Could not extract any text from PDF. Is it a scanned image?")
        
        # 3. Get LLM config (user_id verified at endpoint level)
        logger.info("Step 3: Getting LLM config")
        config = await get_user_llm_config(user_id)
        if not config:
            raise ValueError("No LLM API key configured. Please add one in Settings.")
        
        provider = config["provider"]
        api_key = config["api_key"]
        logger.info(f"Using provider: {provider}")
        
        # 4. Get merchant learnings
        logger.info("Step 4: Getting merchant learnings")
        learnings = await get_merchant_learnings(user_id, household_id)
        
        # 5. Call LLM
        logger.info(f"Step 5: Calling {provider} LLM")
        if provider == "groq":
            llm_response = await call_groq(text, api_key, learnings)
        else:
            llm_response = await call_gemini(text, api_key, learnings)
        
        # Validate and parse response
        try:
            parsed_data = llm_response # Assuming llm_response is already ParsedInvoiceResponse or similar
            
            # Post-processing: Enforce HIGH confidence for learned merchants
            # The LLM prompt encourages this, but we force it here to be sure.
            if learnings: # Renamed from merchant_learnings to learnings to match existing variable
                # Create a lookup for quick matching (normalize to lower case)
                learned_map = {m['merchant_name'].lower(): m['category'] for m in learnings}
                
                for tx in parsed_data.transactions:
                    merchant_lower = tx.merchant.lower()
                    
                    # Check for exact match or if learned merchant is contained in extracted merchant
                    # (e.g. learned "ICA" matches extracted "ICA Supermarket")
                    matched_category = None
                    
                    if merchant_lower in learned_map:
                        matched_category = learned_map[merchant_lower]
                    else:
                        # Try partial match (reverse check: if known key is part of extracted text)
                        for known_merchant, known_category in learned_map.items():
                            if known_merchant in merchant_lower:
                                matched_category = known_category
                                break
                    
                    # If we found a match and the category aligns (or we trust the table more), upgrade confidence
                    if matched_category:
                        # If categories match, definitely HIGH confidence
                        if tx.category.lower() == matched_category.lower():
                            tx.confidence = "HIGH"
                            logger.info(f"Upgraded confidence to HIGH for {tx.merchant} (matched learned category {matched_category})")
                        
                        # OPTIONAL: If LLM got category wrong, should we correct it? 
                        # User said: "They do show the category from the table though" regarding current behavior.
                        # But for robustness, let's correct it if it differs, effectively enforcing the learning.
                        elif tx.confidence != "HIGH":
                            logger.info(f"Correcting category for {tx.merchant}: {tx.category} -> {matched_category} (based on learning)")
                            tx.category = matched_category
                            tx.confidence = "HIGH"

            # 6. Build response
            duration_ms = int((time.time() - start_time) * 1000)
            logger.info(f"Step 6: Building response (took {duration_ms}ms)")
            
            response = ParsedInvoiceResponse(
                language=parsed_data.language, # Changed from llm_response.language to parsed_data.language
                transactions=parsed_data.transactions, # Changed from llm_response.transactions to parsed_data.transactions
                provider_used=provider,
                duration_ms=duration_ms,
                cached=False,
            )
            
            # 7. Cache
            logger.info("Step 7: Caching response")
            _set_cache(cache_key, response)
            
            logger.info(f"=== END parse_invoice SUCCESS ({len(response.transactions)} transactions) ===")
            return response
        except Exception as e:
            logger.error(f"Failed to parse LLM response or during post-processing: {e}", exc_info=True)
            raise ValueError("Invalid LLM response or post-processing failed")
        
    except Exception as e:
        logger.error(f"=== END parse_invoice FAILED: {e} ===", exc_info=True)
        raise


async def save_merchant_mapping(mapping: MerchantMapping) -> bool:
    """Save or update a merchant → category mapping."""
    logger.info(f"Saving merchant mapping: {mapping.merchant_name} -> {mapping.category}")
    
    try:
        supabase = get_supabase_client()
        
        existing = supabase.table("merchant_categories").select("id, times_used").eq(
            "user_id", mapping.user_id
        ).eq(
            "household_id", mapping.household_id
        ).eq(
            "merchant_name", mapping.merchant_name
        ).maybe_single().execute()
        
        if existing.data:
            supabase.table("merchant_categories").update({
                "category": mapping.category,
                "times_used": existing.data["times_used"] + 1,
                "updated_at": "now()",
            }).eq("id", existing.data["id"]).execute()
            logger.info(f"Updated existing mapping (times_used={existing.data['times_used'] + 1})")
        else:
            supabase.table("merchant_categories").insert({
                "user_id": mapping.user_id,
                "household_id": mapping.household_id,
                "merchant_name": mapping.merchant_name,
                "category": mapping.category,
                "times_used": 1,
            }).execute()
            logger.info("Created new merchant mapping")
        
        return True
    except Exception as e:
        logger.error(f"Failed to save merchant mapping: {e}", exc_info=True)
        raise
