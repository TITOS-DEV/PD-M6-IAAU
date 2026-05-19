# stt.py — Speech-to-Text using OpenAI Whisper API
from openai import OpenAI
import os
import io

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def transcribe_audio(audio_bytes: bytes, filename: str = "recording.webm") -> str:
    """Transcribe audio bytes using Whisper-1. Returns plain text."""
    buf = io.BytesIO(audio_bytes)
    buf.name = filename
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=buf,
    )
    return transcript.text
