# SXWer AI ChatBot — Python Microservice

A FastAPI service that adds NLP, safety classification, local LLM inference,
and offline voice processing to the SXWer chatbot. All computation is
local and privacy-first. The Node.js server falls back gracefully when this
service is unavailable.

## Endpoints

| Method | Endpoint | Description | Consent required |
|--------|----------|-------------|-----------------|
| GET | `/health` | Service health + component status | No |
| POST | `/nlp/analyze` | Intent classification + sentiment | Yes |
| POST | `/nlp/classify-safety` | Safety/crisis classification | No (always active) |
| POST | `/llm/chat` | Local LLM via Ollama | Yes |
| POST | `/voice/transcribe` | Offline STT via Vosk | Yes |
| POST | `/voice/synthesize` | Offline TTS via pyttsx3 or Mimic 3 | Yes |
| POST | `/resources/update` | Deduplicate resources.json | — |
| GET | `/resources/validate` | Validate resource URLs | — |

## Quick start

```bash
cd python
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

Add to your `.env` file:

```
PYTHON_API_URL=http://localhost:8000
```

`app.py` auto-loads this `.env` file when the service starts.

The Node.js server will automatically use the Python service for enhanced
safety scoring and local LLM inference when it is running.

## Optional components

### NLP sentiment analysis (transformers + PyTorch)

The service uses keyword-based sentiment by default. For higher accuracy,
install transformers and PyTorch (CPU-only, ~1–2 GB):

```bash
pip install transformers torch --index-url https://download.pytorch.org/whl/cpu
```

### Local LLM (Ollama)

Run a language model entirely on-device — no external API needed.

1. Install Ollama: https://ollama.ai/download
2. Pull a model: `ollama pull mistral`
3. Start the service: `ollama serve`

Set in `.env`:

```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

Other supported models: `phi3`, `llama3`, `gemma`.

### Voice — Speech to Text (Vosk)

1. Download a Vosk model: https://alphacephei.com/vosk/models
   (Recommended: `vosk-model-small-en-us-0.15` for low-resource devices)
2. Extract to `models/vosk-model/`
3. Install: `pip install vosk`

Set in `.env`:

```
VOSK_MODEL_PATH=./models/vosk-model
```

Audio sent to `/voice/transcribe` must be 16 kHz mono 16-bit PCM WAV.

### Voice — Text to Speech (pyttsx3)

pyttsx3 uses system-installed voices and works offline without any model
download.

```bash
pip install pyttsx3
```

### Voice — Higher quality TTS (Mimic 3)

Run Mimic 3 as a local Docker container:

```bash
docker run -d -p 59125:59125 mycroftai/mimic3
```

Set in `.env`:

```
TTS_ENGINE=mimic3
MIMIC3_URL=http://localhost:59125
```

## Safety classifier

The safety classifier (`safety_classifier.py`) trains a scikit-learn
TF-IDF + logistic regression model on startup and caches it as
`safety_model.pkl`. It provides richer crisis and risk-level detection
compared to the static keyword approach in `chatbot.js`.

To add domain-specific training examples, create a
`python/safety_training_data.json` file:

```json
[
  {"text": "I feel trapped and have nowhere to go", "label": "safety_high"},
  {"text": "I want to talk to someone about my trauma", "label": "mental_health"}
]
```

Valid labels: `crisis`, `safety_high`, `mental_health`, `resource_request`, `safe`.

## Privacy

- No user data is sent to external servers.
- Audio and text are processed in memory and never stored.
- All NLP models run on-device.
- Consent is required for AI, NLP, and voice endpoints.
- The safety classification endpoint does not require consent —
  safety checks are always active to protect the user.
