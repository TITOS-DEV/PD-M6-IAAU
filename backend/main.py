# main.py
# FinBot VoiceAgent — FastAPI Backend
# Routes: /chat, /tts, /ingest, /health

import os
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import io

load_dotenv()

from agent import chat
from tts import synthesize_speech
from stt import transcribe_audio
from rag import ingest
from telegram_notify import notify_error

# ─── APP SETUP ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("✅ FinBot backend started")
    yield
    print("🛑 FinBot backend shutting down")

app = FastAPI(
    title="FinBot VoiceAgent API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # In production: restrict to your frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── MODELS ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None   # If None, auto-generate


class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"


class IngestRequest(BaseModel):
    url: str | None = None          # Uses RAG_URL env var if not provided


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Quick liveness check."""
    return {"status": "ok", "agent": "FinBot", "version": "1.0.0"}


@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    """
    Main chat endpoint.
    
    Request:  { message, session_id? }
    Response: { response, tool_used, session_id }
    """
    session_id = req.session_id or str(uuid.uuid4())

    try:
        result = await chat(session_id=session_id, user_message=req.message)
        return {
            "response": result["response"],
            "tool_used": result["tool_used"],   # null or "calculate_interest" etc.
            "session_id": session_id,
        }
    except Exception as e:
        await notify_error(e, context=f"session={session_id}, msg={req.message[:100]}")
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")


@app.post("/tts")
async def tts_endpoint(req: TTSRequest):
    """
    Text-to-Speech endpoint.
    Returns MP3 audio bytes as streaming response.
    
    Request:  { text, voice? }
    Response: audio/mpeg binary stream
    """
    try:
        audio_bytes = synthesize_speech(req.text, voice=req.voice)
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=response.mp3"}
        )
    except Exception as e:
        await notify_error(e, context=f"TTS error for text[:50]={req.text[:50]}")
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")


@app.post("/stt")
async def stt_endpoint(audio: UploadFile = File(...)):
    """
    Speech-to-Text endpoint using OpenAI Whisper.

    Request:  multipart/form-data with field 'audio' (webm/mp4/wav/etc.)
    Response: { text: string }
    """
    try:
        audio_bytes = await audio.read()
        text = transcribe_audio(audio_bytes, filename=audio.filename or "recording.webm")
        return {"text": text}
    except Exception as e:
        await notify_error(e, context="STT error")
        raise HTTPException(status_code=500, detail=f"STT error: {str(e)}")


@app.post("/ingest")
async def ingest_endpoint(req: IngestRequest):
    """
    RAG ingest endpoint — scrapes URL, chunks, embeds, stores in Supabase.
    Run once before demo. Safe to re-run.
    
    Request:  { url? }  — uses RAG_URL env var if not provided
    Response: { status, url, chunks_stored }
    """
    try:
        result = ingest(url=req.url)
        return result
    except Exception as e:
        await notify_error(e, context=f"Ingest error for url={req.url}")
        raise HTTPException(status_code=500, detail=f"Ingest error: {str(e)}")


# ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    await notify_error(exc, context=f"Unhandled: {request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__}
    )
