import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

function useReveal(opts = {}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ob = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); ob.unobserve(el) } },
      { threshold: 0.12, rootMargin: '0px 0px -32px 0px', ...opts }
    )
    ob.observe(el)
    return () => ob.disconnect()
  }, [])
  return [ref, visible]
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

/* ── SVG Icons ── */
function SignalIcon() {
  return (
    <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
      <rect x="0" y="9" width="3" height="3" rx="0.5"/>
      <rect x="4.5" y="6" width="3" height="6" rx="0.5"/>
      <rect x="9" y="3" width="3" height="9" rx="0.5"/>
      <rect x="13.5" y="0" width="3" height="12" rx="0.5"/>
    </svg>
  )
}

function WifiIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
      <path d="M8 9.6a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6zM8 5.4c2.1 0 4 .86 5.37 2.25a.75.75 0 01-1.07 1.05A6.06 6.06 0 008 6.9a6.06 6.06 0 00-4.3 1.8.75.75 0 01-1.07-1.05A7.56 7.56 0 018 5.4zm0-4.2c3.18 0 6.07 1.3 8.15 3.4a.75.75 0 01-1.06 1.06A10.06 10.06 0 008 2.7a10.06 10.06 0 00-7.09 2.96A.75.75 0 01-.15 4.6 11.56 11.56 0 018 1.2z"/>
    </svg>
  )
}

function BatteryIcon() {
  return (
    <svg width="27" height="13" viewBox="0 0 27 13" fill="currentColor">
      <rect x="0.5" y="0.5" width="23" height="12" rx="3" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/>
      <rect x="24.5" y="4" width="2" height="5" rx="1" opacity="0.4"/>
      <rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/>
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5"/>
      <polyline points="5 12 12 5 19 12"/>
    </svg>
  )
}

function ChevronLeft() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 2 2 8 8 14"/>
    </svg>
  )
}

/* ── Typing Dots ── */
function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--text-3)',
          animation: `dotBounce 1.2s ease infinite ${i * 0.15}s`
        }} />
      ))}
    </span>
  )
}

/* ── iPhone with Static Conversations Screenshot ── */
function PhoneMockup() {
  const [ref, visible] = useReveal({ threshold: 0.25 })
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })

  return (
    <div ref={ref} className="iphone-frame" style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0) rotate(0deg)' : 'translateY(32px) rotate(1deg)',
      transition: 'opacity 0.8s ease, transform 0.8s ease',
    }}>
      <div className="iphone-screen">
        <div className="iphone-dynamic-island" />
        <div className="iphone-status-bar">
          <span className="status-time">{timeStr}</span>
          <span className="status-icons">
            <SignalIcon />
            <WifiIcon />
            <BatteryIcon />
          </span>
        </div>
        <div className="phone-screenshot">
          <img src="/assets/conversations.png" alt="Reading Companion conversations" />
        </div>
        <div className="iphone-home-indicator">
          <div className="iphone-home-bar" />
        </div>
      </div>
    </div>
  )
}

/* ── Desktop Chat Mockup (animated) ── */
function DesktopChatMockup() {
  const [cardRef, inView] = useReveal({ threshold: 0.2 })
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [aiTyping, setAiTyping] = useState(false)
  const startedRef = useRef(false)
  const scrollRef = useRef(null)

  const conversation = [
    { role: 'user', text: "mr darcy's first proposal was SO bad 😭" },
    { role: 'ai', text: "Spectacularly bad. He opens with 'against my better judgment' — sir, that is not the compliment you think it is. But honestly it makes everything that comes next hit so much harder. Have you read his letter yet?" },
    { role: 'user', text: "not yet! don't spoil it" },
    { role: 'ai', text: "Lips sealed 🤐 Just keep reading. You're about to have a really good evening." },
  ]

  useEffect(() => {
    if (!inView || startedRef.current) return
    startedRef.current = true
    runSequence()
  }, [inView])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, aiTyping, inputText])

  async function runSequence() {
    await wait(800)
    for (let i = 0; i < conversation.length; i++) {
      const msg = conversation[i]
      if (msg.role === 'user') {
        for (let j = 1; j <= msg.text.length; j++) {
          setInputText(msg.text.slice(0, j))
          await wait(18 + Math.random() * 32)
        }
        await wait(400)
        setInputText('')
        setMessages(prev => [...prev, msg])
        await wait(650)
      } else {
        setAiTyping(true)
        await wait(Math.min(950 + msg.text.length * 4, 2100))
        setAiTyping(false)
        setMessages(prev => [...prev, msg])
        await wait(500)
      }
    }
  }

  return (
    <div ref={cardRef} className="desktop-frame" style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0) rotate(0deg)' : 'translateY(32px) rotate(-1deg)',
      transition: 'opacity 0.8s ease 0.15s, transform 0.8s ease 0.15s',
    }}>
      {/* macOS title bar */}
      <div className="desktop-titlebar">
        <div className="desktop-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <div className="desktop-titlebar-text">Reading Companion</div>
        <div style={{ width: 52 }} />
      </div>

      {/* Sidebar */}
      <div className="desktop-body">
        <div className="desktop-sidebar">
          <div className="sidebar-heading">Conversations</div>
          <div className="sidebar-item active">
            <span className="sidebar-emoji">💌</span>
            <div className="sidebar-item-info">
              <div className="sidebar-item-title">Pride & Prejudice</div>
              <div className="sidebar-item-meta">page 189 of 432</div>
            </div>
          </div>
          <div className="sidebar-item">
            <span className="sidebar-emoji">🧠</span>
            <div className="sidebar-item-info">
              <div className="sidebar-item-title">Atomic Habits</div>
              <div className="sidebar-item-meta">page 64 of 306</div>
            </div>
          </div>
          <div className="sidebar-item">
            <span className="sidebar-emoji">🌊</span>
            <div className="sidebar-item-info">
              <div className="sidebar-item-title">The Old Man and the Sea</div>
              <div className="sidebar-item-meta">page 89 of 127</div>
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="desktop-chat">
          <div className="desktop-chat-header">
            <div className="desktop-chat-avatar">💌</div>
            <div>
              <div className="desktop-chat-title">Pride & Prejudice</div>
              <div className="desktop-chat-meta">Jane Austen · page 189 of 432</div>
            </div>
          </div>
          <div className="desktop-messages" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`desk-msg ${m.role === 'user' ? 'desk-msg-user' : 'desk-msg-ai'}`}>
                {m.text}
              </div>
            ))}
            {aiTyping && (
              <div className="desk-msg desk-msg-ai desk-msg-dots">
                <TypingDots />
              </div>
            )}
          </div>
          <div className="desktop-input-bar">
            <div className="desktop-input">
              {inputText ? (
                <><span>{inputText}</span><span className="type-cursor" /></>
              ) : (
                <span style={{ color: 'var(--text-3)' }}>Message...</span>
              )}
            </div>
            <button className="desktop-send" aria-label={inputText ? 'Send' : 'Voice'}>
              {inputText ? <SendIcon /> : <MicIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Email Form ── */
function EmailForm({ dark = false }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (email.includes('@')) setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="email-success" style={dark ? { color: '#a2d4a5' } : {}}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15"/>
          <path d="M6 10l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        You're in. We'll be in touch soon.
      </div>
    )
  }

  return (
    <form className="email-form" onSubmit={handleSubmit}>
      <input
        type="email" className="email-input"
        placeholder="Your email address"
        value={email} onChange={e => setEmail(e.target.value)}
        required
      />
      <button type="submit" className="email-btn">Get Early Access</button>
    </form>
  )
}

/* ── Features ── */
const features = [
  {
    title: "It's 11pm and you need to talk about chapter 12.",
    body: "Your book club meets Thursday. Your partner's asleep. Your friend hasn't started it yet. But you just read something you can't stop thinking about — and Reading Companion is right there, already caught up to exactly where you are."
  },
  {
    title: "You pick it back up after two weeks.",
    body: "Who was that character again? What happened at the dinner? Instead of flipping back through pages, just ask. A quick “catch me up” and you're right back in it."
  },
  {
    title: "You don't want to keep reading. You want to think.",
    body: "Sometimes a chapter deserves more than moving on. Talk about what just happened — what it meant, why it hit so hard, what the author might be doing. Not a summary. A real conversation."
  }
]

function Feature({ title, body, delay }) {
  const [ref, visible] = useReveal()
  return (
    <div ref={ref} className="feature" style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
    }}>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-body">{body}</p>
    </div>
  )
}

/* ── FAQ ── */
const faqData = [
  {
    q: "What kind of books work?",
    a: "Anything you can upload as a PDF or EPUB. You can also search our library to find books instantly, or add a book manually and just start talking about it."
  },
  {
    q: "How does the spoiler protection work?",
    a: "When you set your current page, the AI only accesses content up to that point. It can’t reference anything beyond where you are. Mention your page in chat — “I’m on page 200 now” — and it adjusts automatically."
  },
  {
    q: "Is this like talking to ChatGPT about a book?",
    a: "Not really. ChatGPT gives you summaries and analysis. Reading Companion gives you a conversation. It has opinions, asks you questions, and talks like someone who genuinely loved the same parts you did."
  },
  {
    q: "How much does it cost?",
    a: "We’re in early access right now. Sign up and you’ll be among the first to try it — free."
  }
]

function FaqItem({ item, isOpen, onToggle, delay }) {
  const [ref, visible] = useReveal()
  return (
    <div ref={ref} className="faq-item" style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
    }}>
      <button className="faq-q" onClick={onToggle}>
        {item.q}
        <svg className={`faq-arrow ${isOpen ? 'open' : ''}`}
             viewBox="0 0 20 20" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round">
          <path d="M5 7.5l5 5 5-5"/>
        </svg>
      </button>
      <div className={`faq-answer-wrap ${isOpen ? 'open' : ''}`}>
        <div>
          <div className="faq-a">{item.a}</div>
        </div>
      </div>
    </div>
  )
}

function FAQ() {
  const [openIdx, setOpenIdx] = useState(null)
  const [headRef, headVisible] = useReveal()

  return (
    <section className="faq-section">
      <h2 ref={headRef} className="faq-heading" style={{
        opacity: headVisible ? 1 : 0,
        transform: headVisible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}>Questions</h2>
      {faqData.map((item, i) => (
        <FaqItem
          key={i} item={item}
          isOpen={openIdx === i}
          onToggle={() => setOpenIdx(openIdx === i ? null : i)}
          delay={0.06 * (i + 1)}
        />
      ))}
    </section>
  )
}

/* ── Footer ── */
function FooterContent() {
  const [ref, visible] = useReveal()
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: 'opacity 0.7s ease, transform 0.7s ease',
    }}>
      <h2 className="footer-headline">Start reading with a friend.</h2>
      <p className="footer-sub">Join the waitlist for early access.</p>
      <EmailForm dark />
      <p className="footer-fine">&copy; 2026 Reading Companion</p>
    </div>
  )
}

/* ── App ── */
export default function LandingPage() {
  return (
    <>
      <nav className="nav">
        <a href="#" className="nav-logo">Reading Companion</a>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link to="/app" className="nav-login">Log in</Link>
          <a href="#footer-cta" className="nav-cta">Get Early Access</a>
        </div>
      </nav>

      <section className="hero">
        <h1 className="hero-headline fade-up">
          Finally, someone to talk to about your book.
        </h1>
        <p className="hero-sub fade-up fade-up-d1">
          An AI who's read the same book as you. Share reactions, ask questions,
          argue about characters — without ever getting a page ahead.
        </p>
        <div className="fade-up fade-up-d2">
          <EmailForm />
        </div>
      </section>

      <div className="showcase">
        <PhoneMockup />
        <DesktopChatMockup />
      </div>

      <div className="ornament">&#9670; &#9670; &#9670;</div>

      <section className="features">
        {features.map((f, i) => (
          <Feature key={i} title={f.title} body={f.body} delay={0.1 * i} />
        ))}
      </section>

      <FAQ />

      <div className="footer-gradient" />
      <footer className="footer" id="footer-cta">
        <FooterContent />
      </footer>
    </>
  )
}
