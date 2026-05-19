# rag.py
# RAG pipeline: scrape URL → chunk → embed → store in Supabase pgvector → retrieve
# Uses text-embedding-3-small (1536 dims) — cheap and fast

import os
import re
import requests
import numpy as np
from bs4 import BeautifulSoup
from openai import OpenAI
from supabase import create_client, Client

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

RAG_URL = os.getenv("RAG_URL", "https://ayuda.nequi.com.co/hc/es")

CHUNK_SIZE = 500       # characters per chunk
CHUNK_OVERLAP = 100    # overlap between consecutive chunks
EMBED_MODEL = "text-embedding-3-small"
TOP_K = 3              # number of chunks to retrieve per query


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ─── SCRAPING ────────────────────────────────────────────────────────────────

def scrape_url(url: str) -> str:
    """Fetch and clean text content from a URL."""
    headers = {"User-Agent": "Mozilla/5.0 (FinBot RAG Indexer)"}
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Remove navigation, scripts, styles, footers
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    text = soup.get_text(separator="\n")
    # Collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


# ─── CHUNKING ─────────────────────────────────────────────────────────────────

def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += size - overlap  # slide forward with overlap
    return chunks


# ─── EMBEDDINGS ───────────────────────────────────────────────────────────────

def embed(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts."""
    response = openai_client.embeddings.create(
        model=EMBED_MODEL,
        input=texts
    )
    return [item.embedding for item in response.data]


def embed_single(text: str) -> list[float]:
    return embed([text])[0]


# ─── INGESTION ────────────────────────────────────────────────────────────────

def ingest(url: str | None = None) -> dict:
    """
    Full ingest pipeline: scrape → chunk → embed → store in Supabase.
    Safe to re-run — clears previous entries for the same URL first.
    """
    target_url = url or RAG_URL
    supabase = get_supabase()

    print(f"[RAG] Scraping: {target_url}")
    raw_text = scrape_url(target_url)

    print(f"[RAG] Chunking {len(raw_text)} chars...")
    chunks = chunk_text(raw_text)
    print(f"[RAG] Generated {len(chunks)} chunks")

    # Clear previous docs for this URL to avoid duplicates
    supabase.table("documents").delete().eq("metadata->>source", target_url).execute()

    print(f"[RAG] Embedding {len(chunks)} chunks...")
    embeddings = embed(chunks)

    # Batch insert into Supabase
    rows = [
        {
            "content": chunk,
            "embedding": emb,
            "metadata": {"source": target_url, "chunk_index": i}
        }
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings))
    ]
    supabase.table("documents").insert(rows).execute()
    print(f"[RAG] Stored {len(rows)} chunks in Supabase")

    return {"status": "ok", "url": target_url, "chunks_stored": len(rows)}


# ─── RETRIEVAL ────────────────────────────────────────────────────────────────

def retrieve(query: str, top_k: int = TOP_K) -> list[str]:
    """
    Retrieve most relevant chunks for a query using cosine similarity.
    Returns list of content strings to inject as RAG context.
    """
    supabase = get_supabase()
    query_embedding = embed_single(query)

    # Use Supabase RPC for vector similarity search
    # This requires the match_documents function to be created in Supabase (see README)
    try:
        result = supabase.rpc("match_documents", {
            "query_embedding": query_embedding,
            "match_count": top_k
        }).execute()

        if result.data:
            return [row["content"] for row in result.data]
    except Exception as e:
        print(f"[RAG] Retrieval error: {e}")

    return []


def build_rag_context(chunks: list[str]) -> str:
    """Format retrieved chunks as context for the system prompt."""
    if not chunks:
        return ""
    joined = "\n\n---\n\n".join(chunks)
    return (
        f"[KNOWLEDGE BASE CONTEXT — use this to answer the user's question]\n\n"
        f"{joined}\n\n"
        f"[END OF CONTEXT]"
    )
