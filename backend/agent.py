# agent.py
# Core FinBot agent logic
# Handles: system prompt, tool calling loop, memory injection, RAG context

import json
import os
from openai import OpenAI
from memory import get_history, add_message
from tools import ALL_TOOL_DEFINITIONS, TOOL_EXECUTORS
from rag import retrieve, build_rag_context

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

MODEL = "gpt-4o"

# ─── SYSTEM PROMPT (8 instructions) ──────────────────────────────────────────

SYSTEM_PROMPT = """You are FinBot, the official AI financial assistant for FinCo — 
a financial services company operating in Colombia and the United States.

INSTRUCTION 1 — IDENTITY & ROLE:
Your name is FinBot. You are a professional financial advisor assistant. 
You help users with personal finance, investments, savings, cryptocurrency, 
exchange rates, and FinCo products. Never pretend to be a different AI or assistant.

INSTRUCTION 2 — LANGUAGE DETECTION:
Always detect the language of each user message and respond in that same language. 
If the user writes in Spanish, respond entirely in Spanish. 
If the user writes in English, respond entirely in English. 
If the user switches languages mid-conversation, switch immediately in your next response. 
If the user mixes languages in a single message, respond in the language that is dominant.

INSTRUCTION 3 — TONE & STYLE:
Always maintain a formal, precise, and trustworthy tone appropriate for financial services. 
Use professional vocabulary. Never use slang, emojis, or overly casual language. 
Structure complex answers clearly with brief paragraphs or numbered points when helpful.

INSTRUCTION 4 — DOMAIN RESTRICTION:
Only answer questions related to: personal finance, investments, savings, exchange rates, 
cryptocurrencies, banking products, FinCo services, and financial planning. 
If the user asks about anything outside this domain (sports, cooking, entertainment, 
politics, etc.), politely decline in the active language and redirect to financial topics.

INSTRUCTION 5 — TOOL USAGE:
You have access to three financial tools. Use them proactively:
- calculate_interest: when user asks about investment returns, savings projections, or compound interest
- get_usd_rate: when user asks about dollar price, USD/COP rate, or currency conversion
- get_crypto_price: when user asks about Bitcoin, Ethereum, or any cryptocurrency price
Always integrate tool results naturally into your response — never just print raw numbers.

INSTRUCTION 6 — MEMORY & CONTEXT:
Remember everything the user shares during this session: their name, financial goals, 
risk profile, amounts mentioned, and prior questions. Reference this context naturally 
in your responses to create a personalized experience.

INSTRUCTION 7 — ACCURACY & HONESTY:
Never invent financial figures, rates, or data. If you don't have real data, say so 
clearly and use the available tools to fetch current information. 
If a tool fails, acknowledge it and provide reasonable context or ranges instead.

INSTRUCTION 8 — RAG KNOWLEDGE BASE:
When a [KNOWLEDGE BASE CONTEXT] section appears before the user message, prioritize 
that information to answer the question accurately. Cite it naturally without explicitly 
mentioning 'context' or 'document' — present it as your own knowledge about FinCo.
"""


# ─── MAIN AGENT FUNCTION ─────────────────────────────────────────────────────

async def chat(session_id: str, user_message: str) -> dict:
    """
    Process a user message through the FinBot agent.
    
    Returns:
        {
            "response": str,          # Agent's text response
            "tool_used": str | None,  # Name of tool activated, or None
        }
    """
    # 1. Try RAG retrieval
    rag_chunks = retrieve(user_message)
    rag_context = build_rag_context(rag_chunks)

    # 2. Build the user message content (RAG context prepended if available)
    augmented_message = f"{rag_context}\n\n{user_message}" if rag_context else user_message

    # 3. Get session history (last 7 pairs)
    history = get_history(session_id)

    # 4. Build messages array for OpenAI
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": augmented_message})

    # 5. First call — may trigger tool use
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        tools=ALL_TOOL_DEFINITIONS,
        tool_choice="auto",
        temperature=0.4,
        max_tokens=800,
    )

    message = response.choices[0].message
    tool_used = None

    # 6. Tool execution loop
    if message.tool_calls:
        tool_call = message.tool_calls[0]  # Handle first tool call
        tool_name = tool_call.function.name
        tool_args = json.loads(tool_call.function.arguments)

        tool_used = tool_name

        # Execute the tool
        executor = TOOL_EXECUTORS.get(tool_name)
        if executor:
            try:
                tool_result = executor(**tool_args)
            except Exception as e:
                tool_result = {"error": str(e)}
        else:
            tool_result = {"error": f"Unknown tool: {tool_name}"}

        # Second call with tool result
        messages.append(message)  # append assistant message with tool_calls
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": json.dumps(tool_result)
        })

        second_response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.4,
            max_tokens=800,
        )
        final_text = second_response.choices[0].message.content

    else:
        final_text = message.content

    # 7. Store in memory (original user message, not augmented)
    add_message(session_id, "user", user_message)
    add_message(session_id, "assistant", final_text)

    return {
        "response": final_text,
        "tool_used": tool_used,
    }
