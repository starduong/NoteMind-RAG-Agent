import time
from typing import Optional

import openai
from openai import OpenAI

from config import (
    GEMINI_API_KEY,
    GITHUB_BASE_URL,
    GITHUB_TOKEN,
    GOOGLE_API_BASE,
    LLM_MODEL,
    LLM_MODEL_PROVIDER,
    OPENROUTER_API_KEY,
    OPENROUTER_APP_NAME,
    OPENROUTER_BASE_URL,
    OPENROUTER_SITE_URL,
)
from utils.logger import api_logger

_clients: dict[str, OpenAI] = {}
_SUPPORTED_PROVIDERS = {"github", "google", "openrouter"}


def _build_client(provider: str) -> OpenAI:
    if provider == "github":
        if not GITHUB_TOKEN:
            raise ValueError(
                "GITHUB_TOKEN is required when using GitHub Models-backed models."
            )
        return OpenAI(
            base_url=GITHUB_BASE_URL,
            api_key=GITHUB_TOKEN,
        )

    if provider == "google":
        if not GEMINI_API_KEY:
            raise ValueError(
                "GEMINI_API_KEY is required when using Google AI Studio-backed models."
            )
        return OpenAI(
            base_url=GOOGLE_API_BASE,
            api_key=GEMINI_API_KEY,
        )

    if provider == "openrouter":
        if not OPENROUTER_API_KEY:
            raise ValueError(
                "OPENROUTER_API_KEY is required when using OpenRouter-backed models."
            )

        client_kwargs = {
            "base_url": OPENROUTER_BASE_URL,
            "api_key": OPENROUTER_API_KEY,
        }
        default_headers = {}
        if OPENROUTER_SITE_URL:
            default_headers["HTTP-Referer"] = OPENROUTER_SITE_URL
        if OPENROUTER_APP_NAME:
            default_headers["X-Title"] = OPENROUTER_APP_NAME
        if default_headers:
            client_kwargs["default_headers"] = default_headers

        return OpenAI(**client_kwargs)

    raise ValueError(f"Unsupported LLM provider: {provider}")


def _provider_base_url(provider: str) -> str:
    if provider == "github":
        return GITHUB_BASE_URL
    if provider == "google":
        return GOOGLE_API_BASE
    if provider == "openrouter":
        return OPENROUTER_BASE_URL
    raise ValueError(f"Unsupported LLM provider: {provider}")


def get_llm_client(provider: str = "github") -> OpenAI:
    provider = (provider or "github").lower()

    if provider not in _SUPPORTED_PROVIDERS:
        raise ValueError(f"Unsupported LLM provider: {provider}")

    if provider not in _clients:
        _clients[provider] = _build_client(provider)
        api_logger.info(
            f"LLM client initialized | provider={provider} | base_url={_provider_base_url(provider)}"
        )

    return _clients[provider]


def chat_complete(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: float = 0.3,
    provider: Optional[str] = None,
    response_format: Optional[dict] = None,
    max_retries: int = 3,
) -> tuple[str, Optional[object]]:
    """
    Chat completion via OpenAI-compatible providers. Returns (content, usage_or_none).
    """
    model = model or LLM_MODEL
    provider = (provider or LLM_MODEL_PROVIDER).lower()
    client = get_llm_client(provider)

    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format:
        kwargs["response_format"] = response_format

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content or ""
            usage = getattr(response, "usage", None)
            return content, usage
        except (openai.RateLimitError, openai.InternalServerError) as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                api_logger.warning(f"LLM API error (attempt {attempt+1}): {e}. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                api_logger.error(f"LLM API failed after {max_retries} attempts.")
                raise e


def generate_text(
    prompt: str,
    model: Optional[str] = None,
    temperature: float = 0.3,
    provider: Optional[str] = None,
    response_format: Optional[dict] = None,
) -> str:
    """Single-turn prompt helper (replaces legacy call_openai)."""
    content, _ = chat_complete(
        messages=[{"role": "user", "content": prompt}],
        model=model,
        temperature=temperature,
        provider=provider,
        response_format=response_format,
    )
    return content
