# telegram_notify.py
# Sends error notifications to a Telegram chat
# Non-blocking — failures here should never crash the main app

import os
import httpx

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

TELEGRAM_API = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"


async def notify_error(error: Exception, context: str = "") -> None:
    """
    Send an error notification to Telegram.
    Silently fails if Telegram is not configured or unreachable.
    """
    if not BOT_TOKEN or not CHAT_ID:
        return  # Telegram not configured — skip silently

    message = (
        f"🚨 *FinBot Error*\n\n"
        f"*Context:* {context}\n"
        f"*Error:* `{type(error).__name__}: {str(error)[:300]}`"
    )

    try:
        async with httpx.AsyncClient(timeout=4) as client:
            await client.post(TELEGRAM_API, json={
                "chat_id": CHAT_ID,
                "text": message,
                "parse_mode": "Markdown"
            })
    except Exception:
        pass  # Never let Telegram failure affect the main response
