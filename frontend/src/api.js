// api.js — FinBot API client
// All backend communication goes through here

const BASE = '/api'  // proxied by Vite to http://localhost:8000

/**
 * Send a chat message to the FinBot agent.
 * @param {string} message
 * @param {string|null} sessionId
 * @returns {Promise<{response: string, tool_used: string|null, session_id: string}>}
 */
export async function sendMessage(message, sessionId = null) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Convert text to speech — returns an audio URL (blob URL).
 * @param {string} text
 * @returns {Promise<string>} blob URL for <audio> element
 */
export async function textToSpeech(text) {
  const res = await fetch(`${BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  })
  if (!res.ok) throw new Error(`TTS failed: HTTP ${res.status}`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

/**
 * Convert recorded audio blob to text via Whisper STT.
 * @param {Blob} audioBlob — audio/webm or audio/mp4 from MediaRecorder
 * @returns {Promise<{text: string}>}
 */
export async function speechToText(audioBlob) {
  const form = new FormData()
  form.append('audio', audioBlob, 'recording.webm')
  const res = await fetch(`${BASE}/stt`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`STT failed: HTTP ${res.status}`)
  return res.json()
}

/**
 * Trigger RAG ingestion for a URL.
 * @param {string|null} url — uses backend default if null
 */
export async function ingestUrl(url = null) {
  const res = await fetch(`${BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  })
  if (!res.ok) throw new Error(`Ingest failed: HTTP ${res.status}`)
  return res.json()
}
