import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

function TypeDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--text-3)',
          animation: `dotBounce 1.2s ease infinite ${i * 0.15}s`
        }} />
      ))}
    </span>
  )
}

const convos = {
  hero: [
    { r: 'u', t: "mr darcy's first proposal was SO bad \u{1F62D}" },
    { r: 'a', t: "Spectacularly bad. He opens with ‘against my better judgment’ — sir, that is not the compliment you think it is. But honestly, it makes everything that comes after hit so much harder. Have you read his letter yet?" },
    { r: 'u', t: "not yet! don't spoil it" },
    { r: 'a', t: "Lips sealed \u{1F910} Just keep reading. You’re about to have a really good evening." },
  ],
  spoiler: [
    { r: 'u', t: "wait does gatsby actually love daisy or is it just the idea of her" },
    { r: 'a', t: "That’s a great question — but you’re on page 84, and I think the book answers it more clearly a bit later. For now, watch how he talks about her vs how he acts around her. There’s a gap there." },
    { r: 'u', t: "ooh okay so I should pay attention to that" },
    { r: 'a', t: "Exactly. And the green light — it’s doing more work than it seems. Keep going, you’ll see what I mean." },
  ],
  catchup: [
    { r: 'u', t: "hey it's been two weeks, can you catch me up?" },
    { r: 'a', t: "Welcome back! You left off right after the dinner scene at Baba’s house. Amir overheard something about Hassan that changes everything. Tensions were really high." },
    { r: 'u', t: "oh right, that part was so tense" },
    { r: 'a', t: "It really was. You were on page 102 — things are about to shift in a big way. Want to pick up from there?" },
  ],
}

const hdrs = {
  hero: { e: '\u{1F48C}', t: 'Pride & Prejudice', m: 'Jane Austen', p: '189' },
  spoiler: { e: '\u{1F7E2}', t: 'The Great Gatsby', m: 'F. Scott Fitzgerald', p: '84' },
  catchup: { e: '\u{1FA81}', t: 'The Kite Runner', m: 'Khaled Hosseini', p: '102' },
}

function ChatMockup({ convoKey }) {
  const [msgs, setMsgs] = useState([])
  const [inp, setInp] = useState('')
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef(null)
  const h = hdrs[convoKey] || hdrs.hero

  useEffect(() => {
    let cancelled = false
    setMsgs([])
    setInp('')
    setTyping(false)
    const convo = convos[convoKey]
    if (!convo) return
    ;(async () => {
      await wait(600)
      for (const m of convo) {
        if (cancelled) return
        if (m.r === 'u') {
          for (let j = 1; j <= m.t.length; j++) {
            if (cancelled) return
            setInp(m.t.slice(0, j))
            await wait(30 + Math.random() * 35)
          }
          await wait(500)
          if (cancelled) return
          setInp('')
          setMsgs(p => [...p, m])
          await wait(1000)
        } else {
          if (cancelled) return
          setTyping(true)
          await wait(Math.min(1200 + m.t.length * 4, 2500))
          if (cancelled) return
          setTyping(false)
          setMsgs(p => [...p, m])
          await wait(Math.min(1500 + m.t.length * 12, 4500))
        }
      }
    })()
    return () => { cancelled = true }
  }, [convoKey])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, typing, inp])

  return (
    <div className="chat">
      <div className="ch">
        <div className="ch-av">{h.e}</div>
        <div style={{ flex: 1 }}>
          <div className="ch-t">{h.t} <span className="ch-pg">pg {h.p}</span></div>
          <div className="ch-m">{h.m}</div>
        </div>
      </div>
      <div className="msgs" ref={scrollRef}>
        {msgs.map((m, i) => (
          <div key={`${convoKey}-${i}`} className={`msg ${m.r === 'u' ? 'msg-user' : 'msg-ai'}`}>{m.t}</div>
        ))}
        {typing && <div className="msg msg-ai" style={{ padding: '11px 15px' }}><TypeDots /></div>}
      </div>
      <div className="chat-input">
        <div className="chat-input-text">
          {inp
            ? <><span>{inp}</span><span className="type-cursor" /></>
            : <span style={{ color: 'var(--text-3)' }}>Message…</span>
          }
        </div>
        <button className="chat-mic">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function EmailForm({ dark }) {
  const [email, setEmail] = useState('')
  const [ok, setOk] = useState(false)
  const go = ev => { ev.preventDefault(); if (email.includes('@')) setOk(true) }

  if (ok) {
    return (
      <div className="ef-ok" style={dark ? { color: '#a2d4a5' } : {}}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15"/>
          <path d="M6 10l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        You're on the list.
      </div>
    )
  }

  return (
    <form className="ef" onSubmit={go}>
      <input type="email" placeholder="Your email address" value={email} onChange={ev => setEmail(ev.target.value)} required />
      <button type="submit">Get Early Access</button>
    </form>
  )
}

export default function LandingPage() {
  const [activeIdx, setActiveIdx] = useState(0)
  const sectionRefs = useRef([])
  const darkSections = [3, 5]

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > 0.5) {
          const i = parseInt(e.target.dataset.idx)
          setActiveIdx(i)

          const nav = document.querySelector('.nav')
          const isDark = e.target.classList.contains('sec--dark')
          nav.classList.toggle('dark', isDark)
          nav.classList.toggle('vis', i > 0 && !isDark)

          const sc = e.target.querySelector('.sec-content')
          if (sc) sc.classList.add('vis')
        }
      })
    }, { threshold: 0.5 })

    sectionRefs.current.forEach(el => { if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [])

  const convoForIdx = ['hero', 'spoiler', 'catchup', null, null, null]
  const activeConvo = convoForIdx[activeIdx]

  function scrollToSection(i) {
    const el = document.querySelector(`[data-idx="${i}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <nav className="nav">
        <a href="#" className="nav-logo">Reading Companion</a>
        <div className="nav-right">
          <Link to="/app" className="nav-login">Log in</Link>
          <button className="nav-cta" onClick={() => scrollToSection(5)}>Get Early Access</button>
        </div>
      </nav>

      {/* 0 — Hero */}
      <section className="sec sec--cream" data-idx="0" ref={el => sectionRefs.current[0] = el}>
        <div className="hero-grid">
          <div className="hero-copy">
            <h1 className="hero-h fu">Someone's reading your book with you.</h1>
            <p className="hero-p fu fu1">A companion on the exact same page — who reads at your pace, but brings the knowledge that makes every chapter richer.</p>
            <div className="fu fu2"><EmailForm /></div>
            <p className="hero-fine fu fu2">Free during early access</p>
          </div>
          <div className="fu fu3">
            <ChatMockup convoKey={activeIdx === 0 ? 'hero' : '__stop'} />
          </div>
        </div>
        <div className="scroll-hint">
          <span>Scroll</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
        </div>
      </section>

      {/* 1 — Spoiler-proof */}
      <section className="sec sec--white" data-idx="1" ref={el => sectionRefs.current[1] = el}>
        <div className="sec-content">
          <div className="spoiler-grid">
            <ChatMockup convoKey={activeIdx === 1 ? 'spoiler' : '__stop'} />
            <div className="spoiler-text">
              <div className="spoiler-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Spoiler-proof
              </div>
              <h2 className="spoiler-h">Always on your page. Never ahead.</h2>
              <p className="spoiler-p">Your companion genuinely cannot access anything past where you are. Not "tries to avoid spoilers" — it's impossible by design.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2 — Catch me up */}
      <section className="sec sec--cream" data-idx="2" ref={el => sectionRefs.current[2] = el}>
        <div className="sec-content">
          <div className="catchup-layout">
            <h2 className="catchup-h">You pick it back up<br/>after two weeks.</h2>
            <div className="catchup-chat">
              <ChatMockup convoKey={activeIdx === 2 ? 'catchup' : '__stop'} />
            </div>
            <p className="catchup-p">Who was that character again? Just ask. A quick "catch me up" and you're right back in it.</p>
          </div>
        </div>
      </section>

      {/* 3 — Voice mode */}
      <section className="sec sec--dark" data-idx="3" ref={el => sectionRefs.current[3] = el}>
        <div className="sec-content">
          <div className="voice-layout">
            <h2 className="voice-h">Talk, don't type.</h2>
            <div className="voice-orb-area">
              <div className="voice-ring" />
              <div className="voice-ring2" />
              <div className="voice-orb" />
            </div>
            <div className="voice-label">Listening…</div>
            <p className="voice-p">Switch to voice when typing isn't enough. Like calling a friend after a chapter that won't leave you alone.</p>
          </div>
        </div>
      </section>

      {/* 4 — How it works */}
      <section className="sec sec--white" data-idx="4" ref={el => sectionRefs.current[4] = el}>
        <div className="sec-content">
          <div className="steps-layout">
            <h2 className="steps-h">Three steps to your first conversation.</h2>
            <div className="steps-cards">
              <div className="scard">
                <div className="scard-n">1</div>
                <div className="scard-t">Add a book</div>
                <div className="scard-d">Upload, search our library, or just type the title.</div>
              </div>
              <div className="scard">
                <div className="scard-n">2</div>
                <div className="scard-t">Set your page</div>
                <div className="scard-d">Your companion knows what you know. Nothing more.</div>
              </div>
              <div className="scard">
                <div className="scard-n">3</div>
                <div className="scard-t">Start talking</div>
                <div className="scard-d">Text or voice. React, question, argue, think out loud.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5 — CTA / Footer */}
      <section className="sec sec--dark" data-idx="5" ref={el => sectionRefs.current[5] = el}>
        <div className="sec-content">
          <div className="cta-inner foot-ef">
            <h2 className="cta-h">Start reading<br/>with a friend.</h2>
            <p className="cta-p">Join the waitlist for early access.</p>
            <EmailForm dark />
            <p className="cta-fine">&copy; 2026 Reading Companion</p>
          </div>
        </div>
      </section>

      {/* Progress dots */}
      <div className="dots">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            className={`pdot ${activeIdx === i ? 'active' : ''} ${darkSections.includes(activeIdx) ? 'dark-mode' : ''}`}
            onClick={() => scrollToSection(i)}
          />
        ))}
      </div>
    </>
  )
}
