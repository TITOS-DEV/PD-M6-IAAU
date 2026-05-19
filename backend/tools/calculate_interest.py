# tools/calculate_interest.py
# Compound interest calculator — pure Python, zero dependencies
# Formula: A = P * (1 + r/n)^(n*t)
# Assuming annual compounding (n=1) for simplicity

def calculate_interest(principal: float, rate: float, years: float) -> dict:
    """
    Calculate compound interest.
    
    Args:
        principal: Initial capital in COP or USD
        rate: Annual interest rate as percentage (e.g. 8 for 8%)
        years: Number of years
    
    Returns:
        dict with final_amount, interest_earned, and rate_used
    """
    r = rate / 100
    final_amount = principal * ((1 + r) ** years)
    interest_earned = final_amount - principal

    return {
        "principal": round(principal, 2),
        "rate_percent": rate,
        "years": years,
        "final_amount": round(final_amount, 2),
        "interest_earned": round(interest_earned, 2),
        "growth_factor": round(final_amount / principal, 4),
    }


# Tool definition for OpenAI function calling
TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "calculate_interest",
        "description": (
            "Calculates compound interest for an investment. "
            "Use when the user asks about investment returns, savings growth, "
            "or how much money they'll have after investing at a given rate."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "principal": {
                    "type": "number",
                    "description": "Initial capital amount in COP or USD"
                },
                "rate": {
                    "type": "number",
                    "description": "Annual interest rate as a percentage (e.g. 8 for 8%)"
                },
                "years": {
                    "type": "number",
                    "description": "Number of years for the investment"
                }
            },
            "required": ["principal", "rate", "years"]
        }
    }
}
