-- supabase_setup.sql
-- Run this ONCE in your Supabase SQL Editor before starting the app
-- Dashboard → SQL Editor → New query → paste → Run

-- Step 1: Enable pgvector extension
create extension if not exists vector;

-- Step 2: Create documents table for RAG storage
create table if not exists documents (
  id bigserial primary key,
  content text not null,
  embedding vector(1536),
  metadata jsonb default '{}'
);

-- Step 3: Create IVFFlat index for fast approximate similarity search
create index if not exists documents_embedding_idx
on documents
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Step 4: Create the similarity search RPC function
-- This is called by rag.py → retrieve()
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

-- Verify setup (run after the above):
-- select * from documents limit 5;
-- select count(*) from documents;
