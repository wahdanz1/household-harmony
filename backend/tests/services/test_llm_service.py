"""Tests for LLM service — rate limiting, caching, PDF extraction, prompt building, and merchant learning."""

import time
from unittest.mock import patch

import pytest

from app.models.llm import LLMTransactionResponse, ParsedInvoiceResponse, Transaction
from app.services.llm_service import (
    _build_extraction_prompt,
    _check_cache,
    _get_cache_key,
    _response_cache,
    _set_cache,
    check_rate_limit,
    _rate_limiter,
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
