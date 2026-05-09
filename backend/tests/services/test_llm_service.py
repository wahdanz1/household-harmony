"""Tests for LLM service — rate limiting, caching, PDF extraction, prompt building, and merchant learning."""

import time
from unittest.mock import MagicMock, patch

import pytest

from app.models.llm import ParsedInvoiceResponse, Transaction
from app.services.llm_service import (
    PDF_MAX_PAGES,
    _build_extraction_prompt,
    _check_cache,
    _get_cache_key,
    _rate_limiter,
    _response_cache,
    _set_cache,
    check_rate_limit,
    extract_text_from_pdf,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clear_caches():
    """Reset module-level caches between tests."""
    _response_cache.clear()
    _rate_limiter.clear()
    yield
    _response_cache.clear()
    _rate_limiter.clear()


def _make_response(**kwargs) -> ParsedInvoiceResponse:
    defaults = {
        "language": "Swedish",
        "transactions": [],
        "provider_used": "gemini",
        "duration_ms": 100,
        "cached": False,
    }
    defaults.update(kwargs)
    return ParsedInvoiceResponse(**defaults)


# ---------------------------------------------------------------------------
# Cache key generation
# ---------------------------------------------------------------------------

class TestCacheKey:
    def test_same_content_same_user_same_key(self):
        pdf = b"fake pdf content"
        assert _get_cache_key(pdf, "user-1") == _get_cache_key(pdf, "user-1")

    def test_different_content_different_key(self):
        assert _get_cache_key(b"pdf-a", "user-1") != _get_cache_key(b"pdf-b", "user-1")

    def test_same_content_different_users_different_keys(self):
        """Cache must be scoped per-user — sharing the same PDF must not
        leak parsed transactions across accounts."""
        pdf = b"identical pdf content"
        assert _get_cache_key(pdf, "user-a") != _get_cache_key(pdf, "user-b")


# ---------------------------------------------------------------------------
# Response caching
# ---------------------------------------------------------------------------

class TestResponseCache:
    def test_cache_hit(self):
        response = _make_response()
        _set_cache("test-key", response)
        cached = _check_cache("test-key")
        assert cached is not None
        assert cached.cached is True
        assert cached.duration_ms == 0

    def test_cache_miss(self):
        assert _check_cache("nonexistent") is None

    def test_cache_expiry(self):
        response = _make_response()
        _set_cache("expiring", response)
        # Manually backdate the timestamp
        _response_cache["expiring"] = (response, time.time() - 301)
        assert _check_cache("expiring") is None

    def test_cache_preserves_transactions(self):
        tx = Transaction(
            date="2025-01-15", merchant="ICA Maxi", amount=450.0,
            category="groceries", confidence="HIGH"
        )
        response = _make_response(transactions=[tx])
        _set_cache("with-tx", response)
        cached = _check_cache("with-tx")
        assert len(cached.transactions) == 1
        assert cached.transactions[0].merchant == "ICA Maxi"


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

class TestRateLimiting:
    def test_under_limit(self):
        for _ in range(4):
            assert check_rate_limit("user-1") is False

    def test_at_limit(self):
        for _ in range(5):
            check_rate_limit("user-1")
        assert check_rate_limit("user-1") is True

    def test_different_users_independent(self):
        for _ in range(5):
            check_rate_limit("user-a")
        # user-b should still be fine
        assert check_rate_limit("user-b") is False

    def test_window_expiry(self):
        for _ in range(5):
            check_rate_limit("user-1")
        # Manually backdate all timestamps past the window
        _rate_limiter["user-1"] = [time.time() - 61 for _ in range(5)]
        assert check_rate_limit("user-1") is False


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------

class TestPromptBuilding:
    def test_includes_text(self):
        prompt = _build_extraction_prompt("Transaction: ICA 450 SEK", [])
        assert "ICA 450 SEK" in prompt

    def test_includes_valid_categories(self):
        prompt = _build_extraction_prompt("test", [])
        assert "groceries" in prompt
        assert "dining_out" in prompt
        assert "healthcare" in prompt

    def test_includes_merchant_learnings(self):
        learnings = [
            {"merchant_name": "ICA Maxi", "category": "groceries", "times_used": 5},
            {"merchant_name": "Netflix", "category": "entertainment", "times_used": 3},
        ]
        prompt = _build_extraction_prompt("test", learnings)
        assert "ICA Maxi -> groceries" in prompt
        assert "Netflix -> entertainment" in prompt

    def test_no_learnings_no_crash(self):
        prompt = _build_extraction_prompt("test", [])
        assert "TEXT START:" in prompt

    def test_json_schema_in_prompt(self):
        prompt = _build_extraction_prompt("test", [])
        assert '"language"' in prompt
        assert '"transactions"' in prompt
        assert '"confidence"' in prompt


# ---------------------------------------------------------------------------
# PDF extraction guardrails
# ---------------------------------------------------------------------------

class TestPdfExtractionGuards:
    """Verify the page-count cap, timeout budget, and safe error surfacing
    around `pdfplumber.open`. We mock pdfplumber to avoid building real PDFs
    (no extra test-only deps) and to make timeout behaviour deterministic.
    """

    @staticmethod
    def _fake_pdf(page_count: int, page_text: str = "Sample text"):
        """Build a context-manager double matching pdfplumber's surface."""
        page = MagicMock()
        page.extract_text.return_value = page_text
        pdf = MagicMock()
        pdf.pages = [page] * page_count
        cm = MagicMock()
        cm.__enter__ = lambda self: pdf
        cm.__exit__ = lambda self, *args: False
        return cm

    @pytest.mark.asyncio
    async def test_normal_pdf_extracts(self):
        with patch(
            "app.services.llm_service.pdfplumber.open",
            return_value=self._fake_pdf(2, "Hello world"),
        ):
            result = await extract_text_from_pdf(b"%PDF-1.4 stub")
        assert "Hello world" in result

    @pytest.mark.asyncio
    async def test_too_many_pages_rejected(self):
        with patch(
            "app.services.llm_service.pdfplumber.open",
            return_value=self._fake_pdf(PDF_MAX_PAGES + 1),
        ):
            with pytest.raises(ValueError, match="too many pages"):
                await extract_text_from_pdf(b"%PDF-1.4 stub")

    @pytest.mark.asyncio
    async def test_at_page_limit_passes(self):
        with patch(
            "app.services.llm_service.pdfplumber.open",
            return_value=self._fake_pdf(PDF_MAX_PAGES),
        ):
            result = await extract_text_from_pdf(b"%PDF-1.4 stub")
        assert isinstance(result, str)

    @pytest.mark.asyncio
    async def test_unparseable_input_returns_safe_message(self):
        """Internal pdfplumber errors must not leak to the client."""
        with pytest.raises(ValueError, match="corrupt|unsupported|too long"):
            await extract_text_from_pdf(b"definitely not a pdf")

    @pytest.mark.asyncio
    async def test_extraction_timeout_surfaces_safe_error(self, monkeypatch):
        import app.services.llm_service as svc

        monkeypatch.setattr(svc, "PDF_EXTRACT_TIMEOUT_SECONDS", 0.05)

        def slow(_bytes):
            time.sleep(1)
            return ""

        monkeypatch.setattr(svc, "_extract_text_sync", slow)

        with pytest.raises(ValueError, match="too long"):
            await svc.extract_text_from_pdf(b"anything")
