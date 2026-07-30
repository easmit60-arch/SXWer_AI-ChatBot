"""
Safety Classification Model

A scikit-learn TF-IDF + logistic regression classifier that improves on the
static SENSITIVE_PATTERNS regex approach in chatbot.js.  The model is trained
on a small seed dataset at import time and cached to disk as `safety_model.pkl`
so subsequent starts are fast.

Falls back to regex-based rules (identical coverage to chatbot.js) when
scikit-learn is not installed.

The training set is intentionally minimal.  Operators may expand it by
providing a `safety_training_data.json` file next to this module:

    [
      {"text": "I feel trapped", "label": "safety_high"},
      ...
    ]

Labels: crisis | safety_high | mental_health | resource_request | safe
"""

import json
import logging
import os
import pickle
import re
from typing import Any, Dict

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional scikit-learn import
# ---------------------------------------------------------------------------
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline

    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_HERE = os.path.dirname(__file__)
MODEL_PATH = os.path.join(_HERE, "safety_model.pkl")
EXTRA_DATA_PATH = os.path.join(_HERE, "safety_training_data.json")

# ---------------------------------------------------------------------------
# Seed training data
# ---------------------------------------------------------------------------
_SEED_DATA = [
    # Crisis
    ("I want to kill myself", "crisis"),
    ("I'm thinking about suicide", "crisis"),
    ("I can't go on anymore", "crisis"),
    ("I want to end my life", "crisis"),
    ("no reason to live", "crisis"),
    ("I've been cutting myself", "crisis"),
    ("I want to overdose", "crisis"),
    ("everyone would be better off without me", "crisis"),
    # High safety risk
    ("I'm being stalked", "safety_high"),
    ("my client is threatening me", "safety_high"),
    ("I'm being trafficked", "safety_high"),
    ("someone is following me home", "safety_high"),
    ("I'm scared for my safety", "safety_high"),
    ("there is domestic violence at home", "safety_high"),
    ("I was assaulted", "safety_high"),
    # Mental health
    ("I'm feeling really depressed", "mental_health"),
    ("I struggle with anxiety every day", "mental_health"),
    ("I have PTSD from past trauma", "mental_health"),
    ("I need to talk to a therapist", "mental_health"),
    ("I'm dealing with an eating disorder", "mental_health"),
    # Resource request
    ("can you help me find resources", "resource_request"),
    ("where can I get support", "resource_request"),
    ("what organizations help sex workers", "resource_request"),
    ("I need legal help", "resource_request"),
    ("how do I contact a support group", "resource_request"),
    # Safe / general
    ("hello how are you", "safe"),
    ("what features do you have", "safe"),
    ("tell me about your privacy policy", "safe"),
    ("I need help with my online profile", "safe"),
    ("can you explain how this works", "safe"),
]

# Severity mapping for each label
SEVERITY_MAP = {
    "crisis": "imminent",
    "safety_high": "high",
    "mental_health": "medium",
    "resource_request": "low",
    "safe": "none",
}

# ---------------------------------------------------------------------------
# Regex fallback rules (mirrors chatbot.js SENSITIVE_KEYWORDS)
# ---------------------------------------------------------------------------
_RULE_PATTERNS = {
    "crisis": [
        r"kill\s+myself",
        r"end\s+my\s+life",
        r"suicid",
        r"want\s+to\s+die",
        r"self[- ]?harm",
        r"overdose",
        r"hang\s+myself",
        r"no\s+reason\s+to\s+live",
        r"can.t\s+go\s+on",
    ],
    "safety_high": [
        r"traffick",
        r"stalking",
        r"\bassault\b",
        r"domestic\s+violence",
        r"exploitation",
        r"in\s+danger",
    ],
    "mental_health": [
        r"depress",
        r"\banxiety\b",
        r"\bptsd\b",
        r"\btrauma\b",
        r"therapist",
        r"bipolar",
        r"eating\s+disorder",
    ],
}

# ---------------------------------------------------------------------------
# Internal state
# ---------------------------------------------------------------------------
_model = None


def _load_extra_data():
    """Load operator-supplied extra training data if present."""
    if not os.path.exists(EXTRA_DATA_PATH):
        return []
    try:
        with open(EXTRA_DATA_PATH, "r", encoding="utf-8") as f:
            rows = json.load(f)
        return [(r["text"], r["label"]) for r in rows if "text" in r and "label" in r]
    except Exception as exc:
        logger.warning("Could not load extra training data: %s", exc)
        return []


def _train_or_load_model():
    """Return a fitted sklearn Pipeline, training and caching if needed."""
    global _model
    if _model is not None:
        return _model

    if not SKLEARN_AVAILABLE:
        return None

    # Try to load cached model
    if os.path.exists(MODEL_PATH):
        try:
            with open(MODEL_PATH, "rb") as f:
                _model = pickle.load(f)
            logger.info("Safety classifier loaded from cache.")
            return _model
        except Exception:
            logger.warning("Cached model invalid — retraining.")

    # Build training set
    data = list(_SEED_DATA) + _load_extra_data()
    texts, labels = zip(*data)

    clf = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), max_features=5000)),
            ("clf", LogisticRegression(max_iter=500, C=1.0, solver="lbfgs")),
        ]
    )
    clf.fit(list(texts), list(labels))

    try:
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(clf, f)
        logger.info("Safety classifier trained and cached.")
    except Exception as exc:
        logger.warning("Could not cache model: %s", exc)

    _model = clf
    return _model


def _rule_based_classify(text: str) -> Dict[str, Any]:
    """Regex fallback — same coverage as chatbot.js SENSITIVE_KEYWORDS."""
    lower = text.lower()
    for label, patterns in _RULE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, lower):
                return {
                    "label": label,
                    "severity": SEVERITY_MAP.get(label, "low"),
                    "confidence": 0.85,
                    "source": "rules",
                    "is_sensitive": True,
                }
    return {
        "label": "safe",
        "severity": "none",
        "confidence": 0.7,
        "source": "rules",
        "is_sensitive": False,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify_safety(text: str) -> Dict[str, Any]:
    """
    Classify text for safety signals.

    Uses the ML model when scikit-learn is available; falls back to regex
    rules otherwise.  The rule-based fallback maintains identical coverage
    to the static patterns in chatbot.js while the ML model improves recall
    on paraphrased or indirect expressions.

    Returns a dict with keys:
      - label       (str)
      - severity    (str)
      - confidence  (float 0–1)
      - source      ("ml_model" | "rules")
      - is_sensitive (bool)
    """
    if not text or not isinstance(text, str):
        return {
            "label": "safe",
            "severity": "none",
            "confidence": 0.0,
            "source": "rules",
            "is_sensitive": False,
        }

    model = _train_or_load_model()

    if model is not None:
        try:
            label = model.predict([text])[0]
            proba = model.predict_proba([text])[0]
            confidence = float(max(proba))
            return {
                "label": label,
                "severity": SEVERITY_MAP.get(label, "low"),
                "confidence": round(confidence, 3),
                "source": "ml_model",
                "is_sensitive": label != "safe",
            }
        except Exception as exc:
            logger.warning("ML classify failed, falling back to rules: %s", exc)

    return _rule_based_classify(text)
