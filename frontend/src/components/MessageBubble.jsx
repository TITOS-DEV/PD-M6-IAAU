// components/MessageBubble.jsx
import { useState, useRef, useEffect } from 'react'

const TOOL_ICONS = {
  calculate_interest: '📊',
  get_usd_rate:       '💱',
  get_crypto_price:   '₿',
}

// ─── Inline markdown parser ───────────────────────────────────────────────────

function parseInline(text, prefix = 'i') {
  if (!text) return null
  const segments = text.split(/(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`)/)
  return segments.map((seg, idx) => {
    const k = `${prefix}-${idx}`
    if (/^\*\*(.+)\*\*$/.test(seg))
      return <strong key={k} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{seg.slice(2, -2)}</strong>
    if (/^\*([^*]+)\*$/.test(seg))
      return <em key={k} style={{ fontStyle: 'italic' }}>{seg.slice(1, -1)}</em>
    if (/^`([^`]+)`$/.test(seg))
      return (
        <code key={k} style={{
          background: 'rgba(89,168,74,0.10)', border: '1px solid rgba(89,168,74,0.20)',
          padding: '1px 5px', borderRadius: 4,
          fontFamily: 'var(--font-mono)', fontSize: '0.87em', color: '#448038',
        }}>
          {seg.slice(1, -1)}
        </code>
      )
    return seg
  })
}

// ─── Block-level markdown renderer ───────────────────────────────────────────

function MarkdownRenderer({ content }) {
  const lines  = content.split('\n')
  const result = []
  let k        = 0
  let listBuf  = [], listKind = null
  let i        = 0
  const key    = () => `md-${k++}`

  const flushList = () => {
    if (!listBuf.length) return
    const Tag = listKind === 'ol' ? 'ol' : 'ul'
    result.push(
      <Tag key={key()} style={{ paddingLeft: '20px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {listBuf.map((item, j) => (
          <li key={j} style={{ color: 'var(--text-primary)', lineHeight: 1.65 }}>
            {parseInline(item, `li-${j}`)}
          </li>
        ))}
      </Tag>
    )
    listBuf = []; listKind = null
  }

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      flushList()
      const code = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++ }
      result.push(
        <pre key={key()} style={{
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '12px 14px',
          fontFamily: 'var(--font-mono)', fontSize: '13px',
          overflowX: 'auto', marginBottom: '10px', lineHeight: 1.55,
          color: 'var(--text-primary)',
        }}>
          <code>{code.join('\n')}</code>
        </pre>
      )
      i++; continue
    }

    if (/^# /.test(line)) {
      flushList()
      result.push(<p key={key()} style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '10px', marginTop: result.length ? '16px' : 0 }}>{parseInline(line.slice(2), `h1-${i}`)}</p>)
      i++; continue
    }
    if (/^## /.test(line)) {
      flushList()
      result.push(<p key={key()} style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '8px', marginTop: result.length ? '14px' : 0 }}>{parseInline(line.slice(3), `h2-${i}`)}</p>)
      i++; continue
    }
    if (/^### /.test(line)) {
      flushList()
      result.push(<p key={key()} style={{ fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '6px', marginTop: result.length ? '12px' : 0 }}>{parseInline(line.slice(4), `h3-${i}`)}</p>)
      i++; continue
    }

    if (/^> /.test(line)) {
      flushList()
      const bq = []
      while (i < lines.length && /^> /.test(lines[i])) { bq.push(lines[i].slice(2)); i++ }
      result.push(
        <div key={key()} style={{ borderLeft: '3px solid #59a84a', paddingLeft: '14px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {bq.map((bl, j) => <p key={j} style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '14px' }}>{parseInline(bl, `bq-${i}-${j}`)}</p>)}
        </div>
      )
      continue
    }

    if (/^[*-] /.test(line)) { if (listKind !== 'ul') { flushList(); listKind = 'ul' }; listBuf.push(line.slice(2)); i++; continue }
    if (/^\d+\. /.test(line)) { if (listKind !== 'ol') { flushList(); listKind = 'ol' }; listBuf.push(line.replace(/^\d+\. /, '')); i++; continue }

    if (/^---+$/.test(line.trim())) {
      flushList()
      result.push(<hr key={key()} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0 12px' }} />)
      i++; continue
    }

    if (line.trim() === '') { flushList(); if (result.length) result.push(<div key={key()} style={{ height: '6px' }} />); i++; continue }

    if (/^\*\*[^*]+\*\*:?$/.test(line.trim())) {
      flushList()
      result.push(<p key={key()} style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '6px', marginTop: result.length ? '10px' : 0 }}>{parseInline(line, `bh-${i}`)}</p>)
      i++; continue
    }

    flushList()
    result.push(<p key={key()} style={{ color: 'var(--text-primary)', lineHeight: 1.65, marginBottom: '2px' }}>{parseInline(line, `p-${i}`)}</p>)
    i++
  }
  flushList()
  return <>{result}</>
}

// ─── ActionRow ────────────────────────────────────────────────────────────────

function ActionRow({ content, visible }) {
  const [copied, setCopied] = useState(false)
  const [vote,   setVote]   = useState(null)

  const copy = () => {
    navigator.clipboard.writeText(content).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const btn = (active, onClick, label, title) => (
    <button onClick={onClick} title={title} style={{
      width: '26px', height: '26px', borderRadius: '7px', border: '1px solid transparent',
      background: active ? 'rgba(89,168,74,0.12)' : 'transparent',
      color: active ? '#448038' : 'var(--text-muted)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', transition: 'all 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(89,168,74,0.08)'; e.currentTarget.style.borderColor = 'rgba(89,168,74,0.2)' }}
    onMouseLeave={e => { e.currentTarget.style.background = active ? 'rgba(89,168,74,0.12)' : 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', gap: '2px', marginBottom: '6px', opacity: visible ? 1 : 0, transition: 'opacity 0.18s' }}>
      {btn(copied,         copy,                                    copied ? '✓' : '⊡', 'Copy')}
      {btn(vote === 'up',  () => setVote(v => v === 'up'   ? null : 'up'),   '↑', 'Helpful')}
      {btn(vote === 'down',() => setVote(v => v === 'down' ? null : 'down'), '↓', 'Not helpful')}
      {btn(false,          () => {},                                '↺', 'Regenerate')}
    </div>
  )
}

// ─── AuroraPlayer ─────────────────────────────────────────────────────────────
// Canvas-based audio visualiser with flowing aurora bands (green ↔ rose)
// that breathe with the actual frequency data from Web Audio API.

function AuroraPlayer({ audioUrl, autoPlay }) {
  const canvasRef = useRef(null)
  const audioRef  = useRef(null)
  const ctxRef    = useRef(null)   // AudioContext
  const anlRef    = useRef(null)   // AnalyserNode
  const rafRef    = useRef(null)   // requestAnimationFrame id
  const tRef      = useRef(0)      // animation clock
  const dataRef   = useRef(new Uint8Array(128))

  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [dur,     setDur]     = useState(0)

  // Aurora wave layer definitions
  const LAYERS = [
    // greens
    { r: 89,  g: 168, b: 74,  phase: 0,   spd: 0.32, fm: 1.00, yOff:  0.04, band: 'bass' },
    { r: 130, g: 200, b: 112, phase: 1.1, spd: 0.22, fm: 0.62, yOff: -0.06, band: 'mid'  },
    // roses
    { r: 201, g: 147, b: 138, phase: 2.3, spd: 0.42, fm: 1.28, yOff:  0.00, band: 'high' },
    { r: 218, g: 168, b: 152, phase: 0.6, spd: 0.28, fm: 0.82, yOff:  0.09, band: 'mid'  },
  ]

  // Unmount cleanup
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    ctxRef.current?.close().catch(() => {})
  }, [])

  // Draw loop — restarts when audioUrl changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Match canvas logical size to CSS display size
    const W = canvas.offsetWidth  || 380
    const H = canvas.offsetHeight || 72
    canvas.width  = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    const getE = (s, e) => {
      const arr = dataRef.current
      const end = Math.min(e, arr.length)
      let sum = 0
      for (let i = s; i < end; i++) sum += arr[i]
      return sum / ((end - s) * 255)
    }

    const frame = () => {
      rafRef.current = requestAnimationFrame(frame)
      tRef.current  += 0.016

      if (anlRef.current) anlRef.current.getByteFrequencyData(dataRef.current)

      const energy = {
        bass: getE(0, 8),
        mid:  getE(8, 32),
        high: getE(32, 80),
      }
      const IDLE = 0.055  // base amplitude when silent

      ctx.clearRect(0, 0, W, H)

      LAYERS.forEach(lyr => {
        const e   = energy[lyr.band]
        const amp = (IDLE + e * 0.30) * H
        const cy  = H * (0.5 + lyr.yOff)
        const rh  = H * (0.09 + e * 0.09)
        const t   = tRef.current

        const yAt = x => {
          const nx = x / W
          return cy
            + Math.sin(nx * Math.PI * 2.6 * lyr.fm + t * lyr.spd + lyr.phase)           * amp * 0.65
            + Math.sin(nx * Math.PI * 4.8 * lyr.fm + t * lyr.spd * 1.45 + lyr.phase)    * amp * 0.35
        }

        // Ribbon: top edge → right → bottom edge back → close
        ctx.beginPath()
        for (let x = 0; x <= W; x += 2) {
          const y = yAt(x)
          x === 0 ? ctx.moveTo(x, y - rh) : ctx.lineTo(x, y - rh)
        }
        for (let x = W; x >= 0; x -= 2) ctx.lineTo(x, yAt(x) + rh)
        ctx.closePath()

        const alpha = 0.28 + e * 0.28
        const grad  = ctx.createLinearGradient(0, 0, W, 0)
        grad.addColorStop(0,    `rgba(${lyr.r},${lyr.g},${lyr.b},0)`)
        grad.addColorStop(0.12, `rgba(${lyr.r},${lyr.g},${lyr.b},${alpha})`)
        grad.addColorStop(0.88, `rgba(${lyr.r},${lyr.g},${lyr.b},${alpha})`)
        grad.addColorStop(1,    `rgba(${lyr.r},${lyr.g},${lyr.b},0)`)
        ctx.fillStyle = grad
        ctx.fill()
      })
    }

    frame()
    return () => cancelAnimationFrame(rafRef.current)
  }, [audioUrl])

  const initWebAudio = () => {
    if (anlRef.current || !audioRef.current) return
    try {
      const ac  = new (window.AudioContext || window.webkitAudioContext)()
      ctxRef.current = ac
      const anl = ac.createAnalyser()
      anl.fftSize = 256
      anl.smoothingTimeConstant = 0.83
      anlRef.current = anl
      dataRef.current = new Uint8Array(anl.frequencyBinCount)
      const src = ac.createMediaElementSource(audioRef.current)
      src.connect(anl)
      anl.connect(ac.destination)
    } catch {}
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    initWebAudio()
    ctxRef.current?.state === 'suspended' && ctxRef.current.resume()
    playing ? audio.pause() : audio.play().catch(() => {})
  }

  const seek = e => {
    if (!audioRef.current || !dur) return
    const rect = e.currentTarget.getBoundingClientRect()
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * dur
  }

  const fmt = s => {
    const m = Math.floor(s / 60), sc = Math.floor(s % 60)
    return `${m}:${sc.toString().padStart(2, '0')}`
  }

  const pct = dur > 0 ? (current / dur) * 100 : 0

  return (
    <div style={{
      marginTop: '10px', width: '100%', maxWidth: '380px',
      background: '#ffffff',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-card)',
    }}>

      {/* Aurora canvas */}
      <div style={{ position: 'relative', height: '72px', background: '#f4f7f2', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', filter: 'blur(0.7px)' }}
        />

        {/* Play/pause button */}
        <button
          onClick={togglePlay}
          style={{
            position: 'absolute', left: '14px', top: '50%',
            transform: 'translateY(-50%)',
            width: '32px', height: '32px', borderRadius: '50%',
            background: playing ? 'rgba(89,168,74,0.85)' : 'rgba(255,255,255,0.88)',
            border: playing ? 'none' : '1px solid var(--border)',
            color: playing ? '#fff' : '#448038',
            cursor: 'pointer', fontSize: '11px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            backdropFilter: 'blur(4px)',
            transition: 'all 0.18s', zIndex: 2,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(-50%) scale(1)' }}
        >
          {playing ? '⏸' : '▶'}
        </button>

        {/* Right timestamp while playing */}
        {playing && (
          <span style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(68,128,56,0.7)',
            zIndex: 2,
          }}>
            {fmt(current)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ padding: '7px 14px 9px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', minWidth: '28px' }}>
          {fmt(current)}
        </span>

        <div
          onClick={seek}
          style={{ flex: 1, height: '3px', background: 'var(--bg-hover)', borderRadius: '2px', cursor: 'pointer', position: 'relative' }}
        >
          <div style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg, #59a84a, #c9938a)',
            borderRadius: '2px', transition: 'width 0.1s linear',
          }} />
        </div>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', minWidth: '28px', textAlign: 'right' }}>
          {fmt(dur)}
        </span>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        autoPlay={autoPlay}
        onPlay={() => { setPlaying(true); initWebAudio(); ctxRef.current?.state === 'suspended' && ctxRef.current.resume() }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0) }}
        onTimeUpdate={() => audioRef.current && setCurrent(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDur(audioRef.current.duration || 0)}
        style={{ display: 'none' }}
      />
    </div>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

export default function MessageBubble({ message }) {
  const isUser    = message.role === 'user'
  const toolUsed  = message.tool_used
  const fromCache = message.from_cache
  const [hovered, setHovered] = useState(false)

  if (isUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', animation: 'fadeUp 0.25s ease-out', gap: '4px' }}>
        <div style={{
          maxWidth: '72%', padding: '10px 18px',
          borderRadius: '22px 22px 6px 22px',
          background: 'rgba(89,168,74,0.09)',
          border: '1px solid rgba(89,168,74,0.18)',
          color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.6,
        }}>
          <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</p>
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', paddingRight: '4px' }}>
          {message.timestamp}
        </span>
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', animation: 'fadeUp 0.25s ease-out', maxWidth: '88%', paddingLeft: '2px' }}
    >
      {/* Tool / cache badges */}
      {(toolUsed || fromCache) && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {toolUsed && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: 'var(--tool-bg)', border: '1px solid var(--tool-border)',
              borderRadius: '20px', padding: '3px 10px',
              fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--tool-text)', letterSpacing: '0.03em',
            }}>
              <span>{TOOL_ICONS[toolUsed] || '⚡'}</span>
              <span>{toolUsed}</span>
            </span>
          )}
          {fromCache && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: 'var(--cache-bg)', border: '1px solid var(--cache-border)',
              borderRadius: '20px', padding: '3px 10px',
              fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--cache-text)', letterSpacing: '0.03em',
            }}>
              <span>■</span><span>Caché</span>
            </span>
          )}
        </div>
      )}

      <ActionRow content={message.content} visible={hovered} />
      <MarkdownRenderer content={message.content} />

      {/* Aurora audio player instead of generic <audio> */}
      {message.audioUrl && (
        <AuroraPlayer audioUrl={message.audioUrl} autoPlay={message.autoPlay} />
      )}

      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', paddingLeft: '2px', marginTop: '4px' }}>
        {message.timestamp}
      </span>
    </div>
  )
}
