from .calculate_interest import calculate_interest, TOOL_DEFINITION as INTEREST_DEF
from .get_usd_rate import get_usd_rate, TOOL_DEFINITION as USD_RATE_DEF
from .get_crypto_price import get_crypto_price, TOOL_DEFINITION as CRYPTO_DEF

ALL_TOOL_DEFINITIONS = [INTEREST_DEF, USD_RATE_DEF, CRYPTO_DEF]

TOOL_EXECUTORS = {
    "calculate_interest": calculate_interest,
    "get_usd_rate": lambda **_: get_usd_rate(),
    "get_crypto_price": get_crypto_price,
}
