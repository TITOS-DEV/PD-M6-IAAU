# tools/get_crypto_price.py
# Fetches cryptocurrency prices from CoinGecko — completely free, no API key
# Supports Bitcoin, Ethereum, and other major coins
# Fallback included for exam safety

import requests

COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price"

# Map common names/tickers to CoinGecko IDs
COIN_MAP = {
    "bitcoin": "bitcoin", "btc": "bitcoin",
    "ethereum": "ethereum", "eth": "ethereum",
    "solana": "solana", "sol": "solana",
    "cardano": "cardano", "ada": "cardano",
    "ripple": "ripple", "xrp": "ripple",
    "usdt": "tether", "tether": "tether",
    "bnb": "binancecoin", "binance": "binancecoin",
    "doge": "dogecoin", "dogecoin": "dogecoin",
}

FALLBACKS = {
    "bitcoin": 68000.0,
    "ethereum": 3500.0,
    "solana": 180.0,
}


def get_crypto_price(coin: str) -> dict:
    """
    Fetch current price of a cryptocurrency in USD and COP.
    
    Args:
        coin: Cryptocurrency name or ticker (e.g. 'bitcoin', 'BTC', 'ethereum')
    
    Returns:
        dict with price_usd, price_cop, coin_id, and source
    """
    coin_lower = coin.lower().strip()
    coin_id = COIN_MAP.get(coin_lower, coin_lower)

    try:
        response = requests.get(
            COINGECKO_URL,
            params={
                "ids": coin_id,
                "vs_currencies": "usd,cop",
                "include_24hr_change": "true"
            },
            timeout=6
        )
        response.raise_for_status()
        data = response.json()

        if coin_id not in data:
            return {
                "error": f"Coin '{coin}' not found on CoinGecko",
                "supported_examples": ["bitcoin", "ethereum", "solana", "cardano"]
            }

        coin_data = data[coin_id]
        return {
            "coin": coin_id,
            "price_usd": coin_data.get("usd", 0),
            "price_cop": coin_data.get("cop", 0),
            "change_24h_percent": round(coin_data.get("usd_24h_change", 0), 2),
            "source": "CoinGecko (real-time)",
        }

    except Exception:
        fallback_price = FALLBACKS.get(coin_id, 0)
        return {
            "coin": coin_id,
            "price_usd": fallback_price,
            "price_cop": fallback_price * 4150,
            "change_24h_percent": None,
            "source": "fallback — CoinGecko unreachable",
        }


# Tool definition for OpenAI function calling
TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "get_crypto_price",
        "description": (
            "Fetches the current market price of a cryptocurrency in USD and COP. "
            "Use when the user asks about Bitcoin, Ethereum, crypto prices, "
            "how much is BTC today, or any cryptocurrency valuation."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "coin": {
                    "type": "string",
                    "description": (
                        "Cryptocurrency name or ticker symbol. "
                        "Examples: 'bitcoin', 'BTC', 'ethereum', 'ETH', 'solana'"
                    )
                }
            },
            "required": ["coin"]
        }
    }
}
