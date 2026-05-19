# tools/get_usd_rate.py
# Fetches USD/COP exchange rate from exchangerate-api.com
# Free tier — no API key required for basic rates
# Fallback to hardcoded rate if API is unreachable (exam safety net)

import requests

FALLBACK_RATE = 4_150.0  # Approximate USD/COP as of 2026 — update if needed
FALLBACK_NOTE = "Tasa de referencia aproximada (datos en tiempo real no disponibles)"

API_URL = "https://open.er-api.com/v6/latest/USD"  # Free, no key required


def get_usd_rate() -> dict:
    """
    Fetch current USD to COP exchange rate.
    
    Returns:
        dict with usd_to_cop rate, source, and timestamp
    """
    try:
        response = requests.get(API_URL, timeout=5)
        response.raise_for_status()
        data = response.json()

        cop_rate = data["rates"].get("COP", FALLBACK_RATE)
        return {
            "usd_to_cop": round(cop_rate, 2),
            "cop_to_usd": round(1 / cop_rate, 6),
            "source": "open.er-api.com",
            "last_updated": data.get("time_last_update_utc", "N/A"),
            "note": "Tasa de mercado en tiempo real"
        }
    except Exception:
        # Graceful fallback — never crash during a demo
        return {
            "usd_to_cop": FALLBACK_RATE,
            "cop_to_usd": round(1 / FALLBACK_RATE, 6),
            "source": "fallback",
            "last_updated": "N/A",
            "note": FALLBACK_NOTE
        }


# Tool definition for OpenAI function calling
TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "get_usd_rate",
        "description": (
            "Returns the current USD to COP (Colombian Peso) exchange rate. "
            "Use when the user asks about the dollar price, exchange rates, "
            "currency conversion between USD and COP, or how much is the dollar today."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
}
