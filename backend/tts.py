# tts.py
# Text-to-Speech using OpenAI TTS API
# Returns raw audio bytes (mp3) ready to stream to frontend

from openai import OpenAI
import os

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def synthesize_speech(text: str, voice: str = "nova") -> bytes:
    """
    Convert text to speech using OpenAI TTS.
    
    Args:
        text: Text to synthesize (max ~4096 chars recommended)
        voice: One of alloy, echo, fable, onyx, nova, shimmer
               'nova' chosen for FinBot — clear, professional, slightly warm
    
    Returns:
        Raw MP3 audio bytes
    """
    # Truncate very long responses to avoid slow TTS
    if len(text) > 1000:
        text = text[:1000] + "..."

    response = client.audio.speech.create(
        model="tts-1",       # tts-1 = faster, tts-1-hd = better quality
        voice=voice,
        input=text,
        response_format="mp3"
    )
    return response.content
