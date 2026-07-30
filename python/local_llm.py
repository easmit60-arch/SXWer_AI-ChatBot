"""
Local LLM Inference via Ollama

Connects to a locally-running Ollama instance (https://ollama.ai) to run
language models such as Mistral 7B, Phi-3, or Llama 3 fully on-device.
No user data leaves the machine — aligning with the project's privacy-first
principle.

Setup:
  1. Install Ollama:  https://ollama.ai/download
  2. Pull a model:    ollama pull mistral
  3. Start service:   ollama serve

Environment variables (set in .env):
  OLLAMA_BASE_URL  — default: http://localhost:11434
  OLLAMA_MODEL     — default: mistral

Raises RuntimeError when Ollama is unavailable so callers can fall back
to built-in ethical local responses without crashing.
"""

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")

_DEFAULT_SYSTEM_PROMPT = (
    "You are SXWer AI ChatBot, a trauma-informed, privacy-first assistant. "
    "Be supportive, non-judgmental, and transparent about limitations. "
    "Avoid diagnosis, never claim authority, and respond with care. "
    "You are not a therapist, doctor, or legal professional. "
    "Keep responses concise and centered on the user's expressed need."
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _is_ollama_available() -> bool:
    """Return True if Ollama is reachable at OLLAMA_BASE_URL."""
    try:
        req = urllib.request.Request(
            f"{OLLAMA_BASE_URL}/api/tags",
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=2):
            return True
    except Exception:
        return False


def _post_json(url: str, payload: Dict, timeout: int = 60) -> Dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_local_response(
    message: str,
    system_prompt: Optional[str] = None,
    max_tokens: int = 320,
) -> str:
    """
    Generate a response using a locally-running Ollama model.

    Args:
        message:       The user's message text.
        system_prompt: Override the default system prompt (optional).
        max_tokens:    Maximum number of tokens to generate.

    Returns:
        The model's text response.

    Raises:
        RuntimeError: If Ollama is unavailable or returns an empty response.
    """
    if not _is_ollama_available():
        raise RuntimeError(
            f"Ollama is not running at {OLLAMA_BASE_URL}. "
            "Start it with `ollama serve` and ensure a model is pulled "
            f"(`ollama pull {OLLAMA_MODEL}`)."
        )

    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt or _DEFAULT_SYSTEM_PROMPT},
            {"role": "user", "content": message},
        ],
        "stream": False,
        "options": {"num_predict": max_tokens},
    }

    try:
        result = _post_json(f"{OLLAMA_BASE_URL}/api/chat", payload)
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Ollama request failed: {exc}") from exc

    content = result.get("message", {}).get("content", "").strip()
    if not content:
        raise RuntimeError("Ollama returned an empty response.")

    return content


def list_available_models() -> List[str]:
    """
    Return names of locally-available Ollama models.
    Returns an empty list when Ollama is unavailable.
    """
    if not _is_ollama_available():
        return []
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return [m["name"] for m in data.get("models", [])]
    except Exception as exc:
        logger.warning("Could not list Ollama models: %s", exc)
        return []


def get_ollama_status() -> Dict[str, Any]:
    """Return availability status and available models."""
    available = _is_ollama_available()
    return {
        "available": available,
        "base_url": OLLAMA_BASE_URL,
        "configured_model": OLLAMA_MODEL,
        "models": list_available_models() if available else [],
    }
