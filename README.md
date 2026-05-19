# FinBot VoiceAgent

> AI-powered personal finance assistant with voice output, tool calling, RAG, and real-time market data.

Built for RIWI · AI Automation Module · 2026

---

## Use Case

FinBot is a formal bilingual (Spanish/English) financial assistant for **FinCo**, a financial services company operating in Colombia and the United States. Users can ask about exchange rates, investment returns, cryptocurrency prices, and FinCo product information — all through a conversational web interface with optional voice output.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + CSS Variables |
| Backend | FastAPI (Python 3.11+) |
| LLM | OpenAI GPT-4o |
| TTS | OpenAI TTS (`tts-1`, voice: nova) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Vector DB | Supabase pgvector |
| Notifications | Telegram Bot API |

---

## Tools

| Tool | Trigger | Description |
|---|---|---|
| `calculate_interest` | Investment/savings questions | Calculates compound interest: A = P(1+r)^t |
| `get_usd_rate` | Dollar/exchange rate questions | Fetches live USD/COP rate from open.er-api.com |
| `get_crypto_price` | Crypto price questions | Fetches live prices from CoinGecko (no API key) |

---

## Setup

### 1. Prerequisites

- Python 3.11+
- Node.js 18+
- A Supabase project with pgvector enabled
- OpenAI API key

### 2. Supabase Setup

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable pgvector
create extension if not exists vector;

-- Documents table for RAG
create table documents (
  id bigserial primary key,
  content text not null,
  embedding vector(1536),
  metadata jsonb default '{}'
);

-- Vector similarity search index
create index on documents
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Stored function for similarity search
create or replace function match_documents(
  query_embedding vector(1536),
  match_count int default 3
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

### 3. Environment Variables

```bash
cp .env.example .env
# Fill in your real values
```

### 4. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

### 6. Ingest RAG documents (optional but recommended)

After both servers are running, click **⬆ index docs** in the UI header, or call:

```bash
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"url": null}'
```

This scrapes the configured `RAG_URL`, chunks and embeds the content, and stores it in Supabase.

---

## Features

- **Bilingual** — auto-detects Spanish/English and responds in the same language
- **Memory** — remembers context for the last 7 message pairs per session
- **3 Live Tools** — interest calculator, USD/COP rate, crypto prices
- **Tool Badges** — UI shows which tool was activated, permanently in history
- **Voice Output** — toggle between Text and Voice mode; voice uses OpenAI TTS
- **RAG** — agent answers questions using scraped web content as context
- **Error Notifications** — backend errors sent to Telegram (optional)

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| POST | `/chat` | Send message to agent |
| POST | `/tts` | Convert text to MP3 audio |
| POST | `/ingest` | Trigger RAG ingestion |

### /chat request/response

```json
// Request
{ "message": "¿A cuánto está el dólar?", "session_id": "uuid-optional" }

// Response
{
  "response": "El tipo de cambio actual es de $4,215.30 COP por dólar...",
  "tool_used": "get_usd_rate",
  "session_id": "generated-or-passed-uuid"
}
```

---

## RAG Source

Default URL: `https://ayuda.nequi.com.co/hc/es`
Configurable via `RAG_URL` environment variable.

---

## Project Structure

```
finbot-voiceagent/
├── backend/
│   ├── main.py                 # FastAPI routes
│   ├── agent.py                # LLM + tool calling + RAG
│   ├── memory.py               # Session memory (7-message window)
│   ├── rag.py                  # Scrape → chunk → embed → retrieve
│   ├── tts.py                  # OpenAI TTS synthesis
│   ├── telegram_notify.py      # Error notifications
│   ├── tools/
│   │   ├── calculate_interest.py
│   │   ├── get_usd_rate.py
│   │   └── get_crypto_price.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx             # Main chat component
│       ├── api.js              # Backend API client
│       └── components/
│           └── MessageBubble.jsx
├── .env.example
└── README.md
```

---

## Technical Decisions

- **In-memory session storage** — sufficient for demo; avoids Redis setup overhead
- **OpenAI SDK direct** (not LangChain) — more predictable tool calling behavior
- **Supabase pgvector** — SQL-native, no local FAISS configuration needed
- **CoinGecko free tier** — no API key required; graceful fallback on timeout
- **Vite proxy** — avoids CORS issues during local development
