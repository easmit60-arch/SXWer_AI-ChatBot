"""
NLP & Sentiment Analysis Service

Uses the transformers pipeline for sentiment analysis and a lightweight
keyword/rule-based intent classifier that degrades gracefully without GPU.

Transformer model runs CPU-only. When transformers is not installed the
module silently falls back to a keyword-based sentiment approximation so
the rest of the service keeps working.
"""

import re
from typing import Any, Dict

# ---------------------------------------------------------------------------
# Optional transformers import (CPU-only, falls back gracefully)
# ---------------------------------------------------------------------------
try:
    from transformers import pipeline as hf_pipeline

    _sentiment_pipeline = hf_pipeline(
        "sentiment-analysis",
        model="distilbert-base-uncased-finetuned-sst-2-english",
        device=-1,  # CPU only — no GPU required
    )
    HF_AVAILABLE = True
except Exception:  # ImportError or model-load failure
    HF_AVAILABLE = False
    _sentiment_pipeline = None

# ---------------------------------------------------------------------------
# Intent patterns — ordered from highest to lowest priority
# ---------------------------------------------------------------------------
INTENT_PATTERNS: Dict[str, list] = {
    "crisis": [
        r"suicid",
        r"self[- ]?harm",
        r"kill\s+myself",
        r"end\s+my\s+life",
        r"want\s+to\s+die",
        r"overdose",
        r"no\s+reason\s+to\s+live",
        r"can.t\s+go\s+on",
    ],
    "safety_concern": [
        r"\babuse\b",
        r"\bassault\b",
        r"\bviolence\b",
        r"stalking",
        r"trafficking",
        r"in\s+danger",
        r"\bunsafe\b",
        r"at\s+risk",
    ],
    "resource_request": [
        r"\bhelp\b",
        r"\bresource",
        r"\bsupport\b",
        r"where\s+can\s+i",
        r"how\s+do\s+i",
        r"who\s+can",
        r"\bcontact\b",
    ],
    "consent_action": [
        r"/consent",
        r"yes.*\b(ai|help)\b",
        r"no.*\b(ai|help)\b",
    ],
    "tool_request": [
        r"/sherlock",
        r"check.*username",
        r"search.*profile",
    ],
    # "general_chat" is the implicit fallback — no patterns needed
}

# Keyword lists used when transformers is unavailable
_NEGATIVE_WORDS = [
    "scared", "afraid", "hurt", "pain", "sad", "angry",
    "desperate", "hopeless", "terrified", "helpless",
]
_POSITIVE_WORDS = [
    "okay", "good", "better", "safe", "grateful",
    "hopeful", "thank", "happy", "relief",
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_intent(text: str) -> Dict[str, Any]:
    """
    Classify user intent using keyword patterns.

    Returns a dict with keys:
      - intent  (str)
      - confidence  (float 0–1)
      - matched_pattern  (str | None)
    """
    if not text or not isinstance(text, str):
        return {"intent": "unknown", "confidence": 0.0, "matched_pattern": None}

    lower = text.lower()

    for intent, patterns in INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, lower):
                return {
                    "intent": intent,
                    "confidence": 0.9,
                    "matched_pattern": pattern,
                }

    return {"intent": "general_chat", "confidence": 0.5, "matched_pattern": None}


def detect_sentiment(text: str) -> Dict[str, Any]:
    """
    Detect emotional tone.

    Uses the DistilBERT sentiment pipeline when transformers is available,
    otherwise falls back to keyword counting.

    Returns a dict with keys:
      - label  ("POSITIVE" | "NEGATIVE" | "NEUTRAL")
      - score  (float 0–1)
      - source ("transformers" | "keyword")
    """
    if not text or not isinstance(text, str):
        return {"label": "NEUTRAL", "score": 0.5, "source": "fallback"}

    if HF_AVAILABLE and _sentiment_pipeline is not None:
        try:
            result = _sentiment_pipeline(text[:512])[0]  # truncate to model max
            return {
                "label": result["label"],
                "score": round(result["score"], 3),
                "source": "transformers",
            }
        except Exception:
            pass  # fall through to keyword fallback

    # Keyword-based fallback
    lower = text.lower()
    neg_count = sum(1 for w in _NEGATIVE_WORDS if w in lower)
    pos_count = sum(1 for w in _POSITIVE_WORDS if w in lower)

    if neg_count > pos_count:
        return {"label": "NEGATIVE", "score": 0.7, "source": "keyword"}
    if pos_count > neg_count:
        return {"label": "POSITIVE", "score": 0.7, "source": "keyword"}
    return {"label": "NEUTRAL", "score": 0.5, "source": "keyword"}
