"""
Offline Voice Pipeline: STT (Vosk) + TTS (pyttsx3 / Mimic 3)

Speech-to-Text (STT):
  Vosk — lightweight, fully offline speech recognition.
  Model download: https://alphacephei.com/vosk/models
  Extract the model folder and set VOSK_MODEL_PATH in .env.
  Input must be 16 kHz mono 16-bit PCM WAV.

Text-to-Speech (TTS):
  pyttsx3 — cross-platform offline TTS using system voices (default).
  Mimic 3 — higher quality, run as a Docker container (optional).

Environment variables (set in .env):
  VOSK_MODEL_PATH  — path to unpacked Vosk model, default: ./models/vosk-model
  TTS_ENGINE       — "pyttsx3" (default) or "mimic3"
  MIMIC3_URL       — Mimic 3 HTTP API URL, default: http://localhost:59125

Both STT and TTS require explicit user consent before being called.
Audio data is never stored or transmitted outside this process.
"""

import io
import json
import logging
import os
import tempfile
import urllib.parse
import urllib.request
import wave
from typing import Optional

logger = logging.getLogger(__name__)

VOSK_MODEL_PATH = os.getenv("VOSK_MODEL_PATH", "./models/vosk-model")
TTS_ENGINE = os.getenv("TTS_ENGINE", "pyttsx3")
MIMIC3_URL = os.getenv("MIMIC3_URL", "http://localhost:59125")

# ---------------------------------------------------------------------------
# Optional Vosk import (STT)
# ---------------------------------------------------------------------------
try:
    from vosk import KaldiRecognizer, Model as VoskModel

    _vosk_model = (
        VoskModel(VOSK_MODEL_PATH) if os.path.exists(VOSK_MODEL_PATH) else None
    )
    VOSK_AVAILABLE = _vosk_model is not None
except ImportError:
    VOSK_AVAILABLE = False
    _vosk_model = None

# ---------------------------------------------------------------------------
# Optional pyttsx3 import (TTS)
# ---------------------------------------------------------------------------
try:
    import pyttsx3

    _tts_engine = pyttsx3.init()
    PYTTSX3_AVAILABLE = True
except Exception:
    PYTTSX3_AVAILABLE = False
    _tts_engine = None


# ---------------------------------------------------------------------------
# STT — Speech to Text
# ---------------------------------------------------------------------------

def transcribe_audio(audio_bytes: bytes) -> str:
    """
    Transcribe WAV audio bytes to text using Vosk (fully offline).

    Args:
        audio_bytes: Raw WAV file bytes. Must be 16 kHz, mono, 16-bit PCM.

    Returns:
        Transcribed text string.

    Raises:
        RuntimeError: If Vosk is not installed or the model is missing.
        ValueError:   If the audio format is not 16 kHz mono 16-bit PCM.
    """
    if not VOSK_AVAILABLE or _vosk_model is None:
        raise RuntimeError(
            "Vosk STT is not available. "
            f"Install it with `pip install vosk` and download a model to {VOSK_MODEL_PATH}. "
            "Models: https://alphacephei.com/vosk/models"
        )

    wav_io = io.BytesIO(audio_bytes)
    with wave.open(wav_io, "rb") as wf:
        if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
            raise ValueError(
                "Audio must be 16 kHz, mono, 16-bit PCM WAV. "
                f"Got: {wf.getframerate()} Hz, {wf.getnchannels()} ch, {wf.getsampwidth() * 8}-bit."
            )

        recognizer = KaldiRecognizer(_vosk_model, wf.getframerate())
        parts: list = []

        while True:
            data = wf.readframes(4000)
            if not data:
                break
            if recognizer.AcceptWaveform(data):
                segment = json.loads(recognizer.Result())
                parts.append(segment.get("text", ""))

        final = json.loads(recognizer.FinalResult())
        parts.append(final.get("text", ""))

    return " ".join(p for p in parts if p).strip()


# ---------------------------------------------------------------------------
# TTS — Text to Speech
# ---------------------------------------------------------------------------

def synthesize_speech(text: str, voice: Optional[str] = None) -> bytes:
    """
    Convert text to speech and return WAV audio bytes.

    Delegates to Mimic 3 (if TTS_ENGINE=mimic3) or pyttsx3 (default).
    Both options are offline-capable and do not transmit audio to external
    servers.

    Args:
        text:  Text to synthesize.
        voice: Optional voice identifier (engine-specific).

    Returns:
        WAV audio bytes.

    Raises:
        RuntimeError: If the selected TTS engine is unavailable.
    """
    if TTS_ENGINE == "mimic3":
        return _synthesize_mimic3(text, voice)
    return _synthesize_pyttsx3(text, voice)


def _synthesize_pyttsx3(text: str, voice: Optional[str] = None) -> bytes:
    """Generate speech using pyttsx3 and return WAV bytes."""
    if not PYTTSX3_AVAILABLE or _tts_engine is None:
        raise RuntimeError(
            "pyttsx3 TTS is not available. Install it with `pip install pyttsx3`."
        )

    if voice:
        voices = _tts_engine.getProperty("voices")
        for v in voices:
            if voice.lower() in v.name.lower() or voice.lower() in v.id.lower():
                _tts_engine.setProperty("voice", v.id)
                break

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        _tts_engine.save_to_file(text, tmp_path)
        _tts_engine.runAndWait()
        with open(tmp_path, "rb") as f:
            return f.read()
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def _synthesize_mimic3(text: str, voice: Optional[str] = None) -> bytes:
    """Generate speech using Mimic 3 HTTP API (local Docker container)."""
    params: dict = {"text": text, "encoding": "PCM"}
    if voice:
        params["voice"] = voice

    url = f"{MIMIC3_URL}/api/tts?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return resp.read()
    except Exception as exc:
        raise RuntimeError(
            f"Mimic 3 TTS request failed ({MIMIC3_URL}). "
            "Ensure Mimic 3 is running: `docker run -d -p 59125:59125 mycroftai/mimic3`"
        ) from exc


def get_voice_status() -> dict:
    """Return availability status of STT and TTS engines."""
    return {
        "stt": {
            "engine": "vosk",
            "available": VOSK_AVAILABLE,
            "model_path": VOSK_MODEL_PATH,
        },
        "tts": {
            "engine": TTS_ENGINE,
            "available": (
                PYTTSX3_AVAILABLE if TTS_ENGINE == "pyttsx3" else True
            ),
            "mimic3_url": MIMIC3_URL if TTS_ENGINE == "mimic3" else None,
        },
    }
