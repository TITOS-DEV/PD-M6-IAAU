import { useState, useRef, useEffect, useCallback } from 'react'
import MessageBubble from './components/MessageBubble.jsx'
import { sendMessage, textToSpeech, ingestUrl, speechToText } from './api.js'

// ─── Constants & helpers ──────────────────────────────────────────────────────

const CHAT_LIST_KEY = 'finbot_chat_list'
const chatKey = id => `finbot_chat_${id}`

// Green accent rgba helper (89, 168, 74 = #59a84a)
const g = a => `rgba(89,168,74,${a})`
// Rose accent rgba helper (201, 147, 138 = #c9938a)
const r = a => `rgba(201,147,138,${a})`

function formatTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)    return 'just now'
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function makeWelcome() {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: "Good day. I'm FinBot, your personal financial assistant from FinCo. I can help you with exchange rates, investment calculations, cryptocurrency prices, and financial guidance.\n\nHow may I assist you today?",
    timestamp: formatTime(),
    tool_used: null,
    from_cache: false,
  }
}

// ─── localStorage ─────────────────────────────────────────────────────────────

function loadChatList()       { try { return JSON.parse(localStorage.getItem(CHAT_LIST_KEY) || '[]') } catch { return [] } }
function saveChatList(list)   { localStorage.setItem(CHAT_LIST_KEY, JSON.stringify(list)) }
function loadMessages(id)     { try { return JSON.parse(localStorage.getItem(chatKey(id)) || 'null') } catch { return null } }
function saveMessages(id, ms) {
  // Strip ephemeral audio data — blob URLs die on reload and autoPlay must not persist
  const persisted = ms.map(({ audioUrl: _a, autoPlay: _b, ...rest }) => rest)
  localStorage.setItem(chatKey(id), JSON.stringify(persisted))
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = '14px', mb = 0 }) {
  return (
    <div style={{
      width, height, borderRadius: 6,
      background: 'linear-gradient(90deg, #eef0ea 25%, #e3e6dc 50%, #eef0ea 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
      marginBottom: mb,
    }} />
  )
}

// ─── PriceChange ──────────────────────────────────────────────────────────────

function PriceChange({ pct }) {
  if (pct == null) return null
  const up = pct >= 0
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '11px',
      color: up ? '#448038' : 'var(--accent-red)',
      display: 'inline-flex', alignItems: 'center', gap: '2px',
      padding: '2px 6px',
      background: up ? g(0.08) : 'rgba(212,88,96,0.08)',
      borderRadius: 4,
    }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
    </span>
  )
}

// ─── MarketCard ───────────────────────────────────────────────────────────────

function MarketCard({ label, dim, children }) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '14px 16px',
      boxShadow: 'var(--shadow-card)',
      opacity: dim ? 0.55 : 1, transition: 'opacity 0.35s ease',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px',
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

// ─── PortfolioCalc ────────────────────────────────────────────────────────────

function PortfolioCalc() {
  const [principal, setPrincipal] = useState('')
  const [rate,      setRate]      = useState('')
  const [years,     setYears]     = useState('')
  const [result,    setResult]    = useState(null)

  const fieldStyle = {
    width: '100%', padding: '7px 10px',
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '12px',
    outline: 'none', transition: 'border-color 0.15s',
  }

  const labelStyle = {
    fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', display: 'block',
  }

  const run = () => {
    const P = parseFloat(principal), rv = parseFloat(rate), t = parseFloat(years)
    if ([P, rv, t].some(v => isNaN(v) || v <= 0)) return
    const A = P * Math.pow(1 + rv / 100, t)
    setResult({ A, gain: A - P })
  }

  const cop = n => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

  return (
    <div style={{
      background: '#ffffff', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '14px 16px',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px',
      }}>
        Portfolio Calculator
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>
          <span style={labelStyle}>Principal</span>
          <input type="number" value={principal} placeholder="10000000"
            onChange={e => { setPrincipal(e.target.value); setResult(null) }}
            onFocus={e  => e.target.style.borderColor = g(0.5)}
            onBlur={e   => e.target.style.borderColor = 'var(--border)'}
            style={fieldStyle} />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Rate %</span>
            <input type="number" value={rate} placeholder="8"
              onChange={e => { setRate(e.target.value); setResult(null) }}
              onFocus={e  => e.target.style.borderColor = g(0.5)}
              onBlur={e   => e.target.style.borderColor = 'var(--border)'}
              style={fieldStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Years</span>
            <input type="number" value={years} placeholder="5"
              onChange={e => { setYears(e.target.value); setResult(null) }}
              onFocus={e  => e.target.style.borderColor = g(0.5)}
              onBlur={e   => e.target.style.borderColor = 'var(--border)'}
              style={fieldStyle} />
          </div>
        </div>

        <button
          onClick={run}
          style={{
            padding: '8px', background: g(0.07),
            border: 'none', borderRadius: '20px',
            color: '#448038', fontFamily: 'var(--font-mono)', fontSize: '11px',
            cursor: 'pointer', letterSpacing: '0.04em', transition: 'var(--transition)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = g(0.14) }}
          onMouseLeave={e => { e.currentTarget.style.background = g(0.07) }}
        >
          CALCULATE
        </button>

        {result && (
          <div style={{
            padding: '10px 12px',
            background: g(0.06), border: `1px solid ${g(0.18)}`,
            borderRadius: 'var(--radius-sm)', animation: 'fadeUp 0.2s ease-out',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '4px' }}>
              FINAL VALUE
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: '#448038', lineHeight: 1 }}>
              {cop(result.A)}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#448038', opacity: 0.65, marginTop: '3px' }}>
              +{cop(result.gain)} gain
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MarketPanel ──────────────────────────────────────────────────────────────

function MarketPanel() {
  const [usdCop,      setUsdCop]      = useState(null)
  const [crypto,      setCrypto]      = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    try {
      const [usdRes, cryptoRes] = await Promise.all([
        fetch('https://open.er-api.com/v6/latest/USD'),
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,cop&include_24hr_change=true'),
      ])
      if (usdRes.ok)    { const d = await usdRes.json();    setUsdCop(d.rates?.COP ?? null) }
      if (cryptoRes.ok) { setCrypto(await cryptoRes.json()) }
      setLastUpdated(new Date())
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, 60000)
    return () => clearInterval(t)
  }, [fetchAll])

  const fmtUSD     = n => n != null ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
  const fmtCOP     = n => n != null ? `≈ $${(n / 1e6).toFixed(2)}M COP` : '—'
  const fmtCOPrate = n => n != null ? n.toLocaleString('es-CO', { maximumFractionDigits: 2 }) : '—'

  const SkeletonCard = () => (
    <div style={{
      background: '#fff', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '14px 16px',
      boxShadow: 'var(--shadow-card)',
    }}>
      <Skeleton width="45%" mb="10px" />
      <Skeleton width="72%" height="26px" mb="8px" />
      <Skeleton width="52%" />
    </div>
  )

  return (
    <div style={{
      width: '300px', flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* Header with subtle rose-green gradient */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        background: `linear-gradient(135deg, ${g(0.06)} 0%, ${r(0.04)} 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1 }}>
            Market Data
          </div>
          {lastUpdated && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px', letterSpacing: '0.05em' }}>
              {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          )}
        </div>
        <button
          onClick={fetchAll} disabled={refreshing}
          style={{
            width: '28px', height: '28px',
            background: 'transparent', border: 'none',
            borderRadius: '50%', color: 'var(--text-muted)',
            cursor: refreshing ? 'default' : 'pointer', fontSize: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
            transition: 'var(--transition)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title="Refresh"
        >⟳</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* USD/COP */}
        {loading ? <SkeletonCard /> : (
          <MarketCard label="USD / COP" dim={refreshing}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', lineHeight: 1, marginBottom: '6px' }}>
              {fmtCOPrate(usdCop)}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Source: open.er-api.com
            </div>
          </MarketCard>
        )}

        {/* Bitcoin */}
        {loading ? <SkeletonCard /> : (
          <MarketCard label="₿ Bitcoin" dim={refreshing}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-primary)', lineHeight: 1 }}>
                {fmtUSD(crypto?.bitcoin?.usd)}
              </div>
              <PriceChange pct={crypto?.bitcoin?.usd_24h_change} />
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
              {fmtCOP(crypto?.bitcoin?.cop)}
            </div>
          </MarketCard>
        )}

        {/* Ethereum */}
        {loading ? <SkeletonCard /> : (
          <MarketCard label="Ξ Ethereum" dim={refreshing}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-primary)', lineHeight: 1 }}>
                {fmtUSD(crypto?.ethereum?.usd)}
              </div>
              <PriceChange pct={crypto?.ethereum?.usd_24h_change} />
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
              {fmtCOP(crypto?.ethereum?.cop)}
            </div>
          </MarketCard>
        )}

        <PortfolioCalc />
      </div>
    </div>
  )
}

// ─── WaveformIcon ─────────────────────────────────────────────────────────────

function WaveformIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <rect x="0"    y="5" width="2" height="2" rx="1" fill="currentColor" />
      <rect x="3.5"  y="3" width="2" height="6" rx="1" fill="currentColor" />
      <rect x="7"    y="0" width="2" height="12" rx="1" fill="currentColor" />
      <rect x="10.5" y="3" width="2" height="6" rx="1" fill="currentColor" />
      <rect x="14"   y="5" width="2" height="2" rx="1" fill="currentColor" />
    </svg>
  )
}

// ─── MicIcon ──────────────────────────────────────────────────────────────────

function MicIcon() {
  return (
    <svg width="13" height="17" viewBox="0 0 13 17" fill="none">
      <rect x="3.5" y="0" width="6" height="9" rx="3" fill="currentColor" />
      <path d="M1 8C1 11.038 3.462 13.5 6.5 13.5C9.538 13.5 12 11.038 12 8"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <line x1="6.5" y1="13.5" x2="6.5" y2="16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="4"   y1="16.5" x2="9"   y2="16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// ─── HamburgerIcon ────────────────────────────────────────────────────────────

function HamburgerIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
      <rect x="0" y="0"  width="18" height="2" rx="1" fill="currentColor" />
      <rect x="0" y="6"  width="13" height="2" rx="1" fill="currentColor" />
      <rect x="0" y="12" width="18" height="2" rx="1" fill="currentColor" />
    </svg>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ chatList, activeChatId, onNewChat, onSelectChat, onDeleteChat }) {
  const [hoveredChatId, setHoveredChatId] = useState(null)
  return (
    <div style={{
      width: '240px', flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* Branding — subtle green gradient wash */}
      <div style={{
        padding: '18px 16px 14px',
        borderBottom: '1px solid var(--border)',
        background: `linear-gradient(180deg, ${g(0.07)} 0%, transparent 100%)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{
            width: '34px', height: '34px', flexShrink: 0,
            background: 'linear-gradient(135deg, #59a84a, #82c870)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '16px',
            color: '#ffffff',
            boxShadow: `0 2px 8px ${g(0.3)}`,
          }}>F</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--text-primary)', lineHeight: 1 }}>
              FinBot
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#448038', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '3px' }}>
              FinCo · AI Assistant
            </div>
          </div>
        </div>

        <button
          onClick={onNewChat}
          style={{
            width: '100%', padding: '8px 14px',
            background: g(0.07), border: 'none',
            borderRadius: '20px', color: '#448038',
            fontFamily: 'var(--font-mono)', fontSize: '11px',
            cursor: 'pointer', letterSpacing: '0.04em',
            textAlign: 'left', transition: 'var(--transition)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = g(0.14) }}
          onMouseLeave={e => { e.currentTarget.style.background = g(0.07) }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
          New Chat
        </button>
      </div>

      {/* Chat list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {chatList.length === 0 ? (
          <div style={{
            padding: '24px 12px', textAlign: 'center',
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            color: 'var(--text-muted)', letterSpacing: '0.05em',
          }}>
            No conversations yet
          </div>
        ) : chatList.map((chat, i) => {
          const active  = activeChatId === chat.id
          const hovered = hoveredChatId === chat.id
          return (
            <div
              key={chat.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectChat(chat.id)}
              onMouseEnter={() => setHoveredChatId(chat.id)}
              onMouseLeave={() => setHoveredChatId(null)}
              style={{
                position: 'relative',
                width: '100%', padding: '9px 34px 9px 10px',
                background: active ? g(0.07) : hovered ? 'var(--bg-hover)' : 'transparent',
                borderLeft: `2px solid ${active ? '#59a84a' : 'transparent'}`,
                borderRadius: `0 var(--radius-sm) var(--radius-sm) 0`,
                cursor: 'pointer', transition: 'var(--transition)',
                animation: `fadeUp 0.3s ease-out ${Math.min(i * 0.04, 0.28)}s both`,
                display: 'flex', flexDirection: 'column', gap: '2px',
              }}
            >
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: '12px', lineHeight: 1.3,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {chat.title || 'New conversation'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                {formatRelative(chat.createdAt)}
              </div>

              {/* Delete button — visible on hover */}
              {hovered && (
                <button
                  onClick={e => { e.stopPropagation(); onDeleteChat(chat.id) }}
                  title="Delete chat"
                  style={{
                    position: 'absolute', right: '7px', top: '50%',
                    transform: 'translateY(-50%)',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: r(0.12), border: 'none',
                    color: 'var(--accent-rose)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', lineHeight: 1, transition: 'var(--transition)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = r(0.24) }}
                  onMouseLeave={e => { e.currentTarget.style.background = r(0.12) }}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Status */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: '#59a84a',
          animation: 'pulse-dot 2s ease-in-out infinite', flexShrink: 0,
        }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          LIVE · GPT-4o
        </span>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [chatList,     setChatList]     = useState(loadChatList)
  const [activeChatId, setActiveChatId] = useState(null)
  const [messages,     setMessages]     = useState([])
  const [chatTitle,    setChatTitle]    = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [voiceMode,    setVoiceMode]    = useState(false)
  const [ingestStatus, setIngestStatus] = useState(null)
  const [inputFocused, setInputFocused] = useState(false)
  const [windowWidth,  setWindowWidth]  = useState(window.innerWidth)
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [recording,    setRecording]    = useState(false)
  const [sttLoading,   setSttLoading]   = useState(false)

  const isMobile = windowWidth < 768

  const sessionId        = useRef(null)
  const messagesEnd      = useRef(null)
  const inputRef         = useRef(null)
  const titleInputRef    = useRef(null)
  const audioCacheRef    = useRef({})
  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])

  // ── Audio cache helpers ───────────────────────────────────────────────────
  // Re-attach blob URLs from the in-session cache when loading stored messages.
  // Blob URLs are ephemeral (die on reload) so we never persist them, but they
  // survive chat-switching within the same tab.
  const loadWithAudio = msgs =>
    msgs.map(m => ({ ...m, audioUrl: audioCacheRef.current[m.id] ?? null, autoPlay: false }))

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const list = loadChatList()
    if (list.length > 0) {
      const latest = list[0]
      const stored = loadMessages(latest.id)
      setActiveChatId(latest.id)
      setMessages(loadWithAudio(stored && stored.length > 0 ? stored : [makeWelcome()]))
      setChatTitle(latest.title || 'New conversation')
    } else {
      const id    = crypto.randomUUID()
      const entry = { id, title: 'New conversation', createdAt: new Date().toISOString() }
      saveChatList([entry])
      setChatList([entry])
      setActiveChatId(id)
      setMessages([makeWelcome()])
      setChatTitle('New conversation')
    }
    sessionId.current = crypto.randomUUID()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (editingTitle) titleInputRef.current?.focus() }, [editingTitle])

  // Persist messages + auto-title
  useEffect(() => {
    if (!activeChatId || messages.length === 0) return
    saveMessages(activeChatId, messages)
    const firstUser = messages.find(m => m.role === 'user')
    if (firstUser) {
      const derived = firstUser.content.slice(0, 44) + (firstUser.content.length > 44 ? '…' : '')
      setChatTitle(prev => (prev === 'New conversation' || prev === '') ? derived : prev)
      setChatList(prev => {
        const updated = prev.map(c =>
          c.id === activeChatId && (c.title === 'New conversation' || c.title === '')
            ? { ...c, title: derived }
            : c
        )
        saveChatList(updated)
        return updated
      })
    }
  }, [messages, activeChatId])

  // ── Chat management ───────────────────────────────────────────────────────

  const deleteChat = id => {
    localStorage.removeItem(chatKey(id))
    setChatList(prev => {
      const updated = prev.filter(c => c.id !== id)
      saveChatList(updated)
      if (activeChatId === id) {
        if (updated.length > 0) {
          const next = updated[0]
          const stored = loadMessages(next.id)
          setActiveChatId(next.id)
          setMessages(stored && stored.length > 0 ? loadWithAudio(stored) : [makeWelcome()])
          setChatTitle(next.title || 'New conversation')
          sessionId.current = crypto.randomUUID()
        } else {
          const newId    = crypto.randomUUID()
          const entry    = { id: newId, title: 'New conversation', createdAt: new Date().toISOString() }
          updated.push(entry)
          saveChatList([entry])
          setActiveChatId(newId)
          setMessages([makeWelcome()])
          setChatTitle('New conversation')
          sessionId.current = crypto.randomUUID()
        }
      }
      return updated
    })
  }

  const createNewChat = () => {
    const id    = crypto.randomUUID()
    const entry = { id, title: 'New conversation', createdAt: new Date().toISOString() }
    setChatList(prev => { const u = [entry, ...prev]; saveChatList(u); return u })
    setActiveChatId(id)
    setMessages([makeWelcome()])
    setChatTitle('New conversation')
    setInput('')
    sessionId.current = crypto.randomUUID()
  }

  const selectChat = id => {
    if (id === activeChatId) return
    const stored = loadMessages(id)
    const chat   = loadChatList().find(c => c.id === id)
    setActiveChatId(id)
    setMessages(stored && stored.length > 0 ? loadWithAudio(stored) : [makeWelcome()])
    setChatTitle(chat?.title || 'New conversation')
    setInput('')
    sessionId.current = crypto.randomUUID()
  }

  const commitTitle = () => {
    setEditingTitle(false)
    if (!activeChatId) return
    setChatList(prev => {
      const updated = prev.map(c => c.id === activeChatId ? { ...c, title: chatTitle } : c)
      saveChatList(updated)
      return updated
    })
  }

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = useCallback(async (text = input) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setInput('')
    setLoading(true)

    setMessages(prev => [...prev, {
      id: crypto.randomUUID(), role: 'user',
      content: trimmed, timestamp: formatTime(),
    }])

    try {
      const data = await sendMessage(trimmed, sessionId.current)
      sessionId.current = data.session_id

      let audioUrl = null
      if (voiceMode) { try { audioUrl = await textToSpeech(data.response) } catch {} }

      const assistantId = crypto.randomUUID()
      if (audioUrl) audioCacheRef.current[assistantId] = audioUrl

      setMessages(prev => [...prev, {
        id: assistantId, role: 'assistant',
        content: data.response,
        tool_used:  data.tool_used  || null,
        from_cache: data.from_cache || false,
        timestamp: formatTime(), audioUrl, autoPlay: voiceMode,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content: `Error connecting to FinBot: ${err.message}`,
        timestamp: formatTime(), tool_used: null, from_cache: false,
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, voiceMode])

  const handleRecord = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop()
      setRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setSttLoading(true)
        try {
          const blob = new Blob(audioChunksRef.current, { type: mimeType })
          const { text } = await speechToText(blob)
          if (text?.trim()) await handleSend(text.trim())
        } catch {}
        finally { setSttLoading(false) }
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch {}
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ── RAG ingest ────────────────────────────────────────────────────────────

  const handleIngest = async () => {
    setIngestStatus('loading')
    try {
      const result = await ingestUrl()
      setIngestStatus(`✓ ${result.chunks_stored} chunks`)
      setTimeout(() => setIngestStatus(null), 4000)
    } catch {
      setIngestStatus('✗ Failed')
      setTimeout(() => setIngestStatus(null), 3000)
    }
  }

  const commitIngestBtn = () => {
    if (ingestStatus?.startsWith('✓')) return '#448038'
    if (ingestStatus && ingestStatus !== 'loading') return 'var(--accent-red)'
    return 'var(--text-muted)'
  }

  const canSend = !loading && !!input.trim()

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-void)', overflow: 'hidden' }}>

      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(28,32,24,0.42)',
            backdropFilter: 'blur(2px)',
            zIndex: 99,
          }}
        />
      )}

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
      <div style={isMobile ? {
        position: 'fixed', top: 0, left: 0, height: '100%', zIndex: 100,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
      } : {}}>
        <Sidebar
          chatList={chatList}
          activeChatId={activeChatId}
          onNewChat={() => { createNewChat(); setSidebarOpen(false) }}
          onSelectChat={id => { selectChat(id); setSidebarOpen(false) }}
          onDeleteChat={deleteChat}
        />
      </div>

      {/* ── CENTER PANEL ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', minWidth: 0 }}>

        {/* Ambient — very soft green wash at top */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '560px', height: '180px',
          background: `radial-gradient(ellipse, ${g(0.05)} 0%, transparent 70%)`,
          pointerEvents: 'none', zIndex: 0,
        }} />

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', height: '52px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-card)',
          flexShrink: 0, position: 'relative', zIndex: 10,
          boxShadow: '0 1px 0 var(--border)',
        }}>

          {/* Hamburger — mobile only */}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(v => !v)}
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: sidebarOpen ? 'var(--bg-hover)' : 'transparent',
                border: 'none', color: 'var(--text-secondary)',
                cursor: 'pointer', flexShrink: 0, marginRight: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'var(--transition)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = sidebarOpen ? 'var(--bg-hover)' : 'transparent' }}
            >
              <HamburgerIcon />
            </button>
          )}

          {/* Editable chat title */}
          <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={chatTitle}
                onChange={e => setChatTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => e.key === 'Enter' && commitTitle()}
                style={{
                  background: 'transparent', border: 'none',
                  borderBottom: `1px solid #59a84a`,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500,
                  outline: 'none', padding: '2px 4px',
                  width: '100%', maxWidth: '340px',
                }}
              />
            ) : (
              <div
                onClick={() => setEditingTitle(true)}
                title="Click to rename"
                style={{
                  fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500,
                  color: 'var(--text-primary)', cursor: 'text',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: '340px',
                }}
              >
                {chatTitle || 'New conversation'}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>

            {/* Index docs — desktop only */}
            {!isMobile && <button onClick={handleIngest} style={{
              padding: '5px 12px',
              background: 'transparent', border: 'none',
              borderRadius: '20px', color: commitIngestBtn(),
              fontFamily: 'var(--font-mono)', fontSize: '10px',
              cursor: 'pointer', letterSpacing: '0.04em', transition: 'var(--transition)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {ingestStatus === 'loading' ? '⟳ indexing...' : ingestStatus || '⬆ index docs'}
            </button>}

            {/* TEXT / VOICE toggle — desktop only (mobile has it in the toolbar) */}
            {!isMobile && (
              <div style={{
                display: 'flex',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: '20px', padding: '3px', gap: '1px',
              }}>
                <button onClick={() => setVoiceMode(false)} style={{
                  padding: '4px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em',
                  transition: 'var(--transition)',
                  background: !voiceMode ? '#fff' : 'transparent',
                  color: !voiceMode ? '#448038' : 'var(--text-muted)',
                  fontWeight: !voiceMode ? 600 : 400,
                  boxShadow: !voiceMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>
                  TEXT
                </button>
                <button onClick={() => setVoiceMode(true)} style={{
                  padding: '4px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em',
                  transition: 'var(--transition)',
                  background: voiceMode ? '#fff' : 'transparent',
                  color: voiceMode ? '#a86860' : 'var(--text-muted)',
                  fontWeight: voiceMode ? 600 : 400,
                  boxShadow: voiceMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>
                  🎙 VOICE
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <main style={{
          flex: 1, overflowY: 'auto',
          padding: isMobile ? '14px 12px' : '20px 24px',
          display: 'flex', flexDirection: 'column', gap: '16px',
          position: 'relative', zIndex: 1,
        }}>
          {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}

          {loading && (
            <div style={{ display: 'flex', paddingLeft: '2px', animation: 'fadeUp 0.2s ease-out' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '10px 2px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: '#59a84a',
                    animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </main>

        {/* Input area */}
        <div style={{
          padding: isMobile ? '6px 10px 10px' : '8px 20px 14px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          flexShrink: 0, position: 'relative', zIndex: 10,
        }}>

          {/* Quick prompts */}
          <div style={{
            display: 'flex', gap: '4px', marginBottom: '8px',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            overflowX: isMobile ? 'auto' : 'visible',
            paddingBottom: isMobile ? '2px' : 0,
          }}>
            {[
              '¿A cuánto está el dólar?',
              'Bitcoin price today?',
              'Si invierto 10M al 8% por 5 años?',
              '¿Horario de FinCo?',
            ].map(p => (
              <button
                key={p} onClick={() => handleSend(p)} disabled={loading}
                style={{
                  padding: '4px 12px', background: 'transparent', border: 'none',
                  borderRadius: '20px', color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', fontSize: '10px',
                  cursor: loading ? 'not-allowed' : 'pointer', transition: 'var(--transition)',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = g(0.08); e.currentTarget.style.color = '#448038' } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Message card — mimics the reference design */}
          <div style={{
            background: '#ffffff',
            border: `1px solid ${inputFocused ? '#59a84a' : 'var(--border)'}`,
            borderRadius: '18px',
            boxShadow: inputFocused
              ? `0 0 0 3px ${g(0.08)}, var(--shadow-card)`
              : 'var(--shadow-card)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            overflow: 'hidden',
          }}>

            {/* Textarea */}
            <div style={{ padding: '14px 18px 10px' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="Escribe un mensaje..."
                disabled={loading}
                rows={1}
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: '14px',
                  resize: 'none', lineHeight: 1.55, maxHeight: '120px', overflowY: 'auto',
                }}
              />
            </div>

            {/* Toolbar — subtle rose tint background */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px 10px',
              background: r(0.025),
            }}>

              {/* Left: attachment + ingest */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {/* + button */}
                <button
                  onClick={handleIngest}
                  title={ingestStatus || 'Index documents'}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'var(--bg-input)', border: 'none',
                    color: ingestStatus?.startsWith('✓') ? '#448038' : 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: '18px', fontWeight: 300,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'var(--transition)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-input)' }}
                >
                  {ingestStatus === 'loading' ? (
                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block', fontSize: '14px' }}>⟳</span>
                  ) : '+'}
                </button>

                {/* Ingest status chip */}
                {ingestStatus && ingestStatus !== 'loading' && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    color: ingestStatus.startsWith('✓') ? '#448038' : 'var(--accent-red)',
                    padding: '2px 8px', borderRadius: '20px',
                    background: ingestStatus.startsWith('✓') ? g(0.08) : 'rgba(212,88,96,0.08)',
                  }}>
                    {ingestStatus}
                  </span>
                )}
              </div>

              {/* Right: model label + send/voice */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                {/* Model label — rose dot accent */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  fontFamily: 'var(--font-mono)', fontSize: '11px',
                  color: 'var(--text-muted)', userSelect: 'none',
                }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'var(--accent-rose)', flexShrink: 0,
                  }} />
                  GPT-4o
                  <span style={{ opacity: 0.5 }}>∨</span>
                </div>

                {/* Response mode toggle: TEXT = text reply, VOICE = audio reply */}
                <button
                  onClick={() => setVoiceMode(v => !v)}
                  title={voiceMode ? 'Responder en texto' : 'Responder con audio'}
                  style={{
                    padding: '0 10px', height: '30px', borderRadius: '15px',
                    background: voiceMode ? r(0.15) : 'transparent',
                    border: `1px solid ${voiceMode ? r(0.3) : 'var(--border)'}`,
                    color: voiceMode ? '#a86860' : 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px',
                    display: 'flex', alignItems: 'center', gap: '5px',
                    transition: 'var(--transition)',
                  }}
                >
                  <span>{voiceMode ? '🔊 AUDIO' : 'TEXTO'}</span>
                </button>

                {/* Mic button — STT via Whisper */}
                <button
                  onClick={handleRecord}
                  disabled={loading || sttLoading}
                  title={recording ? 'Detener grabación' : 'Grabar mensaje de voz'}
                  style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    border: recording ? 'none' : '1px solid var(--border)',
                    background: recording ? 'rgba(212,88,96,0.12)' : 'var(--bg-input)',
                    color: recording ? '#d45860' : sttLoading ? 'var(--text-muted)' : 'var(--text-secondary)',
                    cursor: (loading || sttLoading) ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'var(--transition)',
                    animation: recording ? 'opacity-pulse 1s ease-in-out infinite' : 'none',
                    fontSize: recording ? '14px' : '12px',
                  }}
                  onMouseEnter={e => { if (!recording && !loading) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (!recording) e.currentTarget.style.background = 'var(--bg-input)' }}
                >
                  {sttLoading
                    ? <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block', fontSize: '14px' }}>⟳</span>
                    : recording ? '●' : <MicIcon />}
                </button>

                {/* Send button */}
                <button
                  onClick={() => handleSend()}
                  disabled={!canSend}
                  onMouseDown={e => { if (canSend) e.currentTarget.style.transform = 'scale(0.88)' }}
                  onMouseUp={e   => { e.currentTarget.style.transform = 'scale(1)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    border: 'none', flexShrink: 0,
                    cursor: canSend ? 'pointer' : 'default',
                    background: canSend ? '#59a84a' : 'var(--bg-input)',
                    color: canSend ? '#ffffff' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'var(--transition)',
                    boxShadow: canSend ? `0 2px 8px ${g(0.30)}` : 'none',
                  }}
                >
                  {loading
                    ? <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block', fontSize: '14px' }}>⟳</span>
                    : canSend ? '↑' : <WaveformIcon />}
                </button>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div style={{
            marginTop: '8px', textAlign: 'center',
            fontFamily: 'var(--font-mono)', fontSize: '9px',
            color: 'var(--text-muted)', letterSpacing: '0.05em',
          }}>
            FinCo es IA y puede cometer errores. Por favor, verifica las respuestas.
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — hidden on mobile ────────────────────────────────── */}
      {!isMobile && <MarketPanel />}
    </div>
  )
}
