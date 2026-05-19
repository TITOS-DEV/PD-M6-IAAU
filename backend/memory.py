# memory.py — In-memory session storage
# Stores last 14 entries (7 user + 7 assistant pairs) per session_id
# Resets on server restart — intentional for demo/exam context

from typing import TypedDict

class Message(TypedDict):
    role: str
    content: str

# Global session store: { session_id: [Message, ...] }
_sessions: dict[str, list[Message]] = {}

MAX_PAIRS = 7  # 7 user messages + 7 assistant messages = 14 entries


def get_history(session_id: str) -> list[Message]:
    """Return last MAX_PAIRS*2 messages for a session."""
    return _sessions.get(session_id, [])


def add_message(session_id: str, role: str, content: str) -> None:
    """Append a message and enforce the sliding window."""
    if session_id not in _sessions:
        _sessions[session_id] = []
    _sessions[session_id].append({"role": role, "content": content})
    # Keep only the last MAX_PAIRS * 2 entries (pairs of user+assistant)
    _sessions[session_id] = _sessions[session_id][-(MAX_PAIRS * 2):]


def clear_session(session_id: str) -> None:
    """Remove all history for a session (useful for testing)."""
    _sessions.pop(session_id, None)
