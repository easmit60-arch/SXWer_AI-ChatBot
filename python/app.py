"""
SXWer AI ChatBot — Python Microservice

Provides NLP, safety classification, local LLM inference, voice pipeline,
and resource management as a privacy-first FastAPI service.

All endpoints are optional enhancements to the Node.js server.  The Node
server falls back gracefully when this service is unavailable.

Start:
    uvicorn app:app --host 127.0.0.1 --port 8000

Then set PYTHON_API_URL=http://localhost:8000 in your .env file.
"""

import io
import logging
import os
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from local_llm import generate_local_response, get_ollama_status
from nlp_service import analyze_intent, detect_sentiment
from resource_manager import update_resources, validate_resources
from safety_classifier import classify_safety
from voice_pipeline import get_voice_status, synthesize_speech, transcribe_audio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Security constants for voice processing
MAX_AUDIO_SIZE = 10 * 1024 * 1024  # 10MB max audio file size
ALLOWED_AUDIO_TYPES = {"audio/wav", "audio/x-wav"}

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SXWer AI ChatBot — Python Services",
    description=(
        "Privacy-first NLP, safety classification, local LLM inference, "
        "voice pipeline, and resource management."
    ),
    version="1.0.0",
    # Swagger/ReDoc disabled by default — enable locally if needed for debugging
    docs_url="/docs" if os.getenv("ENABLE_DOCS", "false").lower() == "true" else None,
    redoc_url=None,
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class TextRequest(BaseModel):
    text: str
    consent: bool = False


class ChatRequest(BaseModel):
    message: str
    system_prompt: Optional[str] = None
    max_tokens: int = 320
    consent: bool = False


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None
    consent: bool = False


class ResourcePathRequest(BaseModel):
    resources_path: str = "resources.json"


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Service health check — also reports optional component availability."""
    return {
        "status": "ok",
        "service": "sxwer-python",
        "ollama": get_ollama_status(),
        "voice": get_voice_status(),
    }


# ---------------------------------------------------------------------------
# NLP & Sentiment Analysis
# ---------------------------------------------------------------------------

@app.post("/nlp/analyze")
async def nlp_analyze(req: TextRequest):
    """
    Analyze user text for intent classification and emotional tone.

    Requires ``consent: true`` — the user must explicitly opt in before NLP
    analysis is performed (in line with the project's consent-first principle).
    """
    if not req.consent:
        raise HTTPException(
            status_code=403,
            detail="Explicit consent is required for NLP analysis.",
        )
    try:
        intent = analyze_intent(req.text)
        sentiment = detect_sentiment(req.text)
        return {"intent": intent, "sentiment": sentiment}
    except Exception as exc:
        logger.error("NLP analysis error: %s", exc)
        raise HTTPException(status_code=500, detail="NLP analysis unavailable.") from exc


# ---------------------------------------------------------------------------
# Safety Classification
# ---------------------------------------------------------------------------

@app.post("/nlp/classify-safety")
async def nlp_classify_safety(req: TextRequest):
    """
    Classify user text for safety and crisis signals.

    Consent is intentionally NOT required here — safety checks are always
    active to protect the user, consistent with the project's safety principle.
    """
    try:
        result = classify_safety(req.text)
        return result
    except Exception as exc:
        logger.error("Safety classification error: %s", exc)
        raise HTTPException(
            status_code=500, detail="Safety classification unavailable."
        ) from exc


# ---------------------------------------------------------------------------
# Local LLM Inference (Ollama)
# ---------------------------------------------------------------------------

@app.post("/llm/chat")
async def llm_chat(req: ChatRequest):
    """
    Generate a response using a locally-running Ollama language model.

    Requires ``consent: true``.  Returns HTTP 503 with a clear message when
    Ollama is not running so the Node server can fall back gracefully.
    """
    if not req.consent:
        raise HTTPException(
            status_code=403,
            detail="Explicit consent is required for AI assistance.",
        )
    try:
        response = generate_local_response(
            req.message,
            system_prompt=req.system_prompt,
            max_tokens=req.max_tokens,
        )
        return {"response": response, "local": True, "provider": "ollama"}
    except RuntimeError as exc:
        logger.warning("Local LLM unavailable: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("Local LLM error: %s", exc)
        raise HTTPException(status_code=500, detail="Local LLM error.") from exc


# ---------------------------------------------------------------------------
# Voice Pipeline — STT
# ---------------------------------------------------------------------------

@app.post("/voice/transcribe")
async def voice_transcribe(
    consent: bool = Query(False),
    audio: UploadFile = File(...),
):
    """
    Transcribe uploaded WAV audio to text using Vosk (fully offline STT).

    Audio requirements: 16 kHz, mono, 16-bit PCM WAV.
    Requires ``consent=true`` query parameter.
    Audio bytes are processed in memory and never persisted.
    """
    if not consent:
    
    # Validate file type
    if audio.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio type: {audio.content_type}. Only WAV files are accepted.",
        )
        raise HTTPException(
            status_code=403,
            detail="Explicit consent is required for voice processing.",
        )
    try:
        audio_bytes = await audio.read()
        
        # Validate file size
        if len(audio_bytes) > MAX_AUDIO_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Audio file too large. Maximum: {MAX_AUDIO_SIZE // (1024*1024)}MB.",
            )
        text = transcribe_audio(audio_bytes)
        return {"text": text, "local": True, "engine": "vosk"}
    except (RuntimeError, ValueError) as exc:
        logger.warning("Transcription unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Transcription error: %s", exc)
        raise HTTPException(status_code=500, detail="Transcription error.") from exc


# ---------------------------------------------------------------------------
# Voice Pipeline — TTS
# ---------------------------------------------------------------------------

@app.post("/voice/synthesize")
async def voice_synthesize(req: TTSRequest):
    """
    Convert text to speech (offline TTS via pyttsx3 or Mimic 3).

    Returns a WAV audio stream.
    Requires ``consent: true``.
    """
    if not req.consent:
        raise HTTPException(
            status_code=403,
            detail="Explicit consent is required for voice synthesis.",
        )
    try:
        audio_bytes = synthesize_speech(req.text, voice=req.voice)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/wav")
    except RuntimeError as exc:
        logger.warning("TTS unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("TTS error: %s", exc)
        raise HTTPException(status_code=500, detail="TTS error.") from exc


# ---------------------------------------------------------------------------
# Resource Management
# ---------------------------------------------------------------------------

@app.post("/resources/update")
async def resources_update(req: ResourcePathRequest):
    """
    Deduplicate entries in resources.json and rewrite it in place.
    Returns a summary of changes made.
    """
    try:
        result = await update_resources(req.resources_path)
        return result
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Resource update error: %s", exc)
        raise HTTPException(status_code=500, detail="Resource update failed.") from exc


@app.get("/resources/validate")
async def resources_validate(path: str = Query("resources.json")):
    """
    Validate URLs in resources.json without modifying the file.
    Returns a reachability report for all organization entries.
    """
    try:
        result = await validate_resources(path)
        return result
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Resource validation error: %s", exc)
        raise HTTPException(status_code=500, detail="Resource validation failed.") from exc
