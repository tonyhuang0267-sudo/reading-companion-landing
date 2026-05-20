import { useState, useRef, useEffect, useCallback } from "react";
import VoiceMode from "./VoiceMode.jsx";
import TourGuide from "./TourGuide.jsx";

const API = import.meta.env.VITE_API_URL || "/api";

function apiFetch(url, opts = {}, username) {
  const headers = { ...opts.headers };
  if (username) headers["X-Username"] = username;
  return fetch(url, { ...opts, headers });
}

const formatMsg = (text) => {
  return text.split("\n").map((line, li) => (
    <span key={li}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, pi) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={pi} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>
          : part
      )}
      {li < text.split("\n").length - 1 && <br />}
    </span>
  ));
};

const TypingDots = () => (
  <div style={{ display: "flex", gap: 5, padding: "4px 0", alignItems: "center" }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: 7, height: 7, borderRadius: "50%", background: "#999",
        animation: `pulse 1.3s ease-in-out ${i * 0.15}s infinite`,
      }} />
    ))}
    <style>{`@keyframes pulse {
      0%,60%,100% { opacity:.3; transform:scale(.85) }
      30% { opacity:1; transform:scale(1.1) }
    }`}</style>
  </div>
);

const GENRE_PROMPTS = [
  { icon: "☕", text: "Catch me up" },
  { icon: "🤔", text: "Explain what I just read" },
  { icon: "💬", text: "I want to discuss a passage" },
];

export default function ReadingApp({ onLogout, username }) {
  const f = (url, opts) => apiFetch(url, opts, username);
  const [books, setBooks] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddBook, setShowAddBook] = useState(false);
  const [showUpload, setShowUpload] = useState(null);
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showVoiceMode, setShowVoiceMode] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const fetchBooks = useCallback(async () => {
    try {
      const res = await f(`${API}/books`);
      const data = await res.json();
      setBooks(data);
    } catch (e) {
      console.error("Failed to fetch books:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteBook = async (bookId, e) => {
    e.stopPropagation();
    if (!confirm("Delete this book and all its conversations?")) return;
    try {
      await f(`${API}/books/${bookId}`, { method: "DELETE" });
      setBooks(prev => prev.filter(b => b.id !== bookId));
    } catch (err) {
      console.error("Failed to delete book:", err);
    }
  };

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (activeChat) {
      inputRef.current?.focus();
      fetchMessages(activeChat);
    }
  }, [activeChat]);

  const fetchMessages = async (bookId) => {
    try {
      const res = await f(`${API}/books/${bookId}/messages`);
      const data = await res.json();
      setMessages(data.map(m => ({ role: m.role === "user" ? "user" : "ai", text: m.content })));
    } catch (e) {
      console.error("Failed to fetch messages:", e);
    }
  };

  const sendMessage = async (text, isCatchup = false) => {
    if (!text.trim() || !activeChat) return;
    const userMsg = { role: "user", text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const endpoint = isCatchup
        ? `${API}/books/${activeChat}/catchup`
        : `${API}/books/${activeChat}/messages`;

      const res = await f(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: isCatchup ? undefined : JSON.stringify({ content: text.trim() }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      setTyping(false);
      setMessages(prev => [...prev, { role: "ai", text: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              aiText += data.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "ai", text: aiText };
                return updated;
              });
            }
          } catch {}
        }
      }
      fetchBooks();
    } catch (e) {
      console.error("Message failed:", e);
      setTyping(false);
      setMessages(prev => [...prev, { role: "ai", text: "Sorry, something went wrong. Please try again." }]);
    }
  };

  const handleCatchup = () => {
    setMessages(prev => [...prev, { role: "user", text: "Catch me up" }]);
    setTyping(true);
    f(`${API}/books/${activeChat}/catchup`, { method: "POST" })
      .then(res => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let aiText = "";
        setTyping(false);
        setMessages(prev => [...prev, { role: "ai", text: "" }]);
        const read = () => {
          reader.read().then(({ done, value }) => {
            if (done) { fetchBooks(); return; }
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
            for (const line of lines) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  aiText += data.text;
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "ai", text: aiText };
                    return updated;
                  });
                }
              } catch {}
            }
            read();
          });
        };
        read();
      });
  };

  const handleAddBook = async (title, author, emoji) => {
    try {
      const res = await f(`${API}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author, cover_emoji: emoji }),
      });
      const book = await res.json();
      setShowAddBook(false);
      setShowUpload(book.id);
      await fetchBooks();
    } catch (e) {
      console.error("Failed to add book:", e);
    }
  };

  const handleUpload = async (bookId, file) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await f(`${API}/books/${bookId}/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setShowUpload(null);
      await fetchBooks();
    } catch (e) {
      console.error("Upload failed:", e);
      alert("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePageUpdate = async () => {
    const page = parseInt(pageInput, 10);
    if (!page || page < 1) return;
    try {
      await f(`${API}/books/${activeChat}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_page: page }),
      });
      await fetchBooks();
      setEditingPage(false);
    } catch (e) {
      console.error("Page update failed:", e);
    }
  };

  const book = activeChat ? books.find(b => b.id === activeChat) : null;
  const isEmpty = messages.length === 0;

  const fonts = `@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');`;

  const P = {
    bg: "#F6F3EE", surface: "#FFFFFF", border: "#E5DDD2", borderLight: "#EDE8E0",
    text: "#1A1714", textSec: "#7A6F60", textTer: "#AEA393",
    accent: "#6B4D30", accentSoft: "#EDE0D1", accentHover: "#7D5A38",
    userBubble: "#6B4D30", aiBubble: "#F0EBE3",
    online: "#5B9A5F",
  };

  const AddBookModal = () => {
    const [step, setStep] = useState("upload");
    const [title, setTitle] = useState("");
    const [author, setAuthor] = useState("");
    const [emoji, setEmoji] = useState("📖");
    const [selectedFile, setSelectedFile] = useState(null);
    const [extracting, setExtracting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [downloading, setDownloading] = useState(null);
    const fileRef = useRef(null);
    const emojis = ["📖", "📚", "🏜️", "⚛️", "🧬", "🔮", "🌊", "🗡️", "🧠", "💡", "🌍", "🚀"];

    const handleSearch = async () => {
      if (!searchQuery.trim()) return;
      setSearching(true);
      setSearchResults([]);
      setHasSearched(true);
      try {
        const res = await f(`${API}/books/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery }),
        });
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setSearching(false);
      }
    };

    const handleDownloadResult = async (result) => {
      setDownloading(result.md5);
      try {
        const bookRes = await f(`${API}/books`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: result.title,
            author: result.author,
            cover_emoji: emoji,
          }),
        });
        const book = await bookRes.json();
        setShowAddBook(false);
        setUploading(true);
        setShowUpload(book.id);

        const dlRes = await f(`${API}/books/${book.id}/download-libgen`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            md5: result.md5,
            extension: result.extension,
          }),
        });
        if (!dlRes.ok) {
          const err = await dlRes.json();
          alert("Download failed: " + (err.detail || "Unknown error"));
        }
        setShowUpload(null);
        setUploading(false);
        await fetchBooks();
      } catch (e) {
        console.error("Download failed:", e);
        setUploading(false);
        setShowUpload(null);
      } finally {
        setDownloading(null);
      }
    };

    const handleFileSelect = async (file) => {
      if (!file) return;
      setSelectedFile(file);
      setExtracting(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await f(`${API}/books/extract-metadata`, {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (data.title) setTitle(data.title);
        if (data.author) setAuthor(data.author);
      } catch (e) {
        console.error("Metadata extraction failed:", e);
      } finally {
        setExtracting(false);
        setStep("details");
      }
    };

    const handleSubmit = async () => {
      if (!title.trim()) return;
      try {
        const res = await f(`${API}/books`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, author, cover_emoji: emoji }),
        });
        const book = await res.json();
        if (selectedFile) {
          setUploading(true);
          setShowAddBook(false);
          setShowUpload(book.id);
          const form = new FormData();
          form.append("file", selectedFile);
          const uploadRes = await f(`${API}/books/${book.id}/upload`, {
            method: "POST",
            body: form,
          });
          if (!uploadRes.ok) {
            const err = await uploadRes.json();
            alert("Processing failed: " + (err.detail || "Unknown error"));
          }
          setShowUpload(null);
          setUploading(false);
        }
        setShowAddBook(false);
        await fetchBooks();
      } catch (e) {
        console.error("Failed to add book:", e);
        setUploading(false);
      }
    };

    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      }} onClick={() => !extracting && !uploading && setShowAddBook(false)}>
        <div style={{
          background: P.surface, borderRadius: 20, padding: 28, width: 360,
          maxWidth: "90vw",
        }} onClick={e => e.stopPropagation()}>

          {step === "upload" && (
            <>
              <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 20, margin: "0 0 8px", color: P.text }}>
                Add a New Book
              </h2>
              <p style={{ fontSize: 13, color: P.textSec, margin: "0 0 20px", lineHeight: 1.5 }}>
                Upload a PDF or EPUB and we'll fill in the details for you.
              </p>
              <input ref={fileRef} type="file" accept=".pdf,.epub" style={{ display: "none" }}
                onChange={e => e.target.files[0] && handleFileSelect(e.target.files[0])}
              />
              {extracting ? (
                <div style={{ textAlign: "center", padding: 20 }}>
                  <TypingDots />
                  <div style={{ fontSize: 13, color: P.textSec, marginTop: 8 }}>Reading book info...</div>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} style={{
                  width: "100%", padding: "20px", borderRadius: 16,
                  border: `2px dashed ${P.border}`, background: "transparent",
                  cursor: "pointer", textAlign: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = P.accent; e.currentTarget.style.background = P.accentSoft; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{"📄"}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: P.accent, fontFamily: "'DM Sans', sans-serif" }}>
                    Choose PDF or EPUB
                  </div>
                  <div style={{ fontSize: 12, color: P.textTer, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
                    We'll extract the title and author automatically
                  </div>
                </button>
              )}
              <div style={{ display: "flex", gap: 12, marginTop: 14, justifyContent: "center" }}>
                <button onClick={() => setStep("search")} style={{
                  background: "none", border: "none",
                  color: P.accent, fontSize: 13, cursor: "pointer", fontWeight: 500,
                }}>
                  Find online
                </button>
                <span style={{ color: P.border }}>|</span>
                <button onClick={() => { setStep("details"); }} style={{
                  background: "none", border: "none",
                  color: P.textTer, fontSize: 13, cursor: "pointer",
                }}>
                  Enter manually
                </button>
              </div>
            </>
          )}

          {step === "search" && (
            <>
              <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 20, margin: "0 0 8px", color: P.text }}>
                Find a Book
              </h2>
              <p style={{ fontSize: 13, color: P.textSec, margin: "0 0 14px", lineHeight: 1.5 }}>
                Search by title or author
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="e.g. Atomic Habits"
                  autoFocus
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${P.border}`,
                    fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box",
                  }}
                />
                <button onClick={handleSearch} disabled={searching || !searchQuery.trim()} style={{
                  padding: "10px 16px", borderRadius: 12, border: "none",
                  background: searchQuery.trim() ? P.accent : P.border, color: "#FFF",
                  fontSize: 14, fontWeight: 600, cursor: searchQuery.trim() ? "pointer" : "default",
                  fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
                }}>
                  {searching ? "..." : "Search"}
                </button>
              </div>

              {searching && (
                <div style={{ textAlign: "center", padding: 20 }}>
                  <TypingDots />
                  <div style={{ fontSize: 13, color: P.textSec, marginTop: 8 }}>Searching...</div>
                </div>
              )}

              {!searching && searchResults.length > 0 && (
                <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                  {searchResults.map((r, i) => (
                    <div key={i} style={{
                      padding: "10px 14px", borderRadius: 12, border: `1px solid ${P.border}`,
                      cursor: downloading ? "default" : "pointer",
                      opacity: downloading && downloading !== r.md5 ? 0.4 : 1,
                      transition: "all 0.15s",
                    }}
                    onClick={() => !downloading && handleDownloadResult(r)}
                    onMouseEnter={e => { if (!downloading) e.currentTarget.style.borderColor = P.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = P.border; }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: P.text, lineHeight: 1.3 }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: 12, color: P.textSec, marginTop: 2 }}>
                        {r.author}{r.year ? ` · ${r.year}` : ""} · {r.extension.toUpperCase()} · {r.size}
                      </div>
                      {downloading === r.md5 && (
                        <div style={{ fontSize: 11, color: P.accent, marginTop: 4 }}>Downloading & processing...</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!searching && searchResults.length === 0 && hasSearched && (
                <div style={{ textAlign: "center", padding: 16, color: P.textTer, fontSize: 13 }}>
                  No results found. Try a different search.
                </div>
              )}

              <button onClick={() => { setStep("upload"); setSearchResults([]); }} style={{
                display: "block", margin: "14px auto 0", background: "none", border: "none",
                color: P.textTer, fontSize: 13, cursor: "pointer",
              }}>
                {"←"} Back to upload
              </button>
            </>
          )}

          {step === "details" && (
            <>
              <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 20, margin: "0 0 6px", color: P.text }}>
                {selectedFile ? "Confirm Details" : "Book Details"}
              </h2>
              {selectedFile && (
                <div style={{ fontSize: 12, color: P.online, marginBottom: 14, display: "flex", alignItems: "center", gap: 4 }}>
                  {"✓"} {selectedFile.name}
                </div>
              )}
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Book title"
                autoFocus
                style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${P.border}`,
                  fontSize: 14, fontFamily: "'DM Sans', sans-serif", marginBottom: 10, boxSizing: "border-box", outline: "none" }}
              />
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${P.border}`,
                  fontSize: 14, fontFamily: "'DM Sans', sans-serif", marginBottom: 14, boxSizing: "border-box", outline: "none" }}
              />
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: P.textSec, marginBottom: 6 }}>Pick an emoji</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {emojis.map(e => (
                    <button key={e} onClick={() => setEmoji(e)} style={{
                      width: 36, height: 36, borderRadius: 10, border: emoji === e ? `2px solid ${P.accent}` : `1px solid ${P.border}`,
                      background: emoji === e ? P.accentSoft : "transparent", fontSize: 18, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{e}</button>
                  ))}
                </div>
              </div>
              <button onClick={handleSubmit}
                disabled={!title.trim()}
                style={{
                  width: "100%", padding: "12px", borderRadius: 14, border: "none",
                  background: title.trim() ? P.accent : P.border, color: "#FFF",
                  fontSize: 14, fontWeight: 600, cursor: title.trim() ? "pointer" : "default",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                {selectedFile ? "Add Book & Process" : "Add Book"}
              </button>
              {!selectedFile && (
                <button onClick={() => setStep("upload")} style={{
                  display: "block", margin: "10px auto 0", background: "none", border: "none",
                  color: P.textTer, fontSize: 13, cursor: "pointer",
                }}>
                  {"←"} Upload a file instead
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const UploadModal = () => {
    const fileRef = useRef(null);
    const targetBook = books.find(b => b.id === showUpload);

    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      }} onClick={() => !uploading && setShowUpload(null)}>
        <div style={{
          background: P.surface, borderRadius: 20, padding: 28, width: 340,
          maxWidth: "90vw", textAlign: "center",
        }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{targetBook?.cover_emoji || "📖"}</div>
          <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 18, margin: "0 0 6px", color: P.text }}>
            Upload Book File
          </h2>
          <p style={{ fontSize: 13, color: P.textSec, marginBottom: 20 }}>
            Upload a PDF or EPUB of <strong>{targetBook?.title}</strong> so I can read along with you.
          </p>
          {uploading ? (
            <div style={{ padding: 20 }}>
              <TypingDots />
              <div style={{ fontSize: 13, color: P.textSec, marginTop: 8 }}>Processing book...</div>
            </div>
          ) : (
            <>
              <input ref={fileRef} type="file" accept=".pdf,.epub" style={{ display: "none" }}
                onChange={e => e.target.files[0] && handleUpload(showUpload, e.target.files[0])}
              />
              <button onClick={() => fileRef.current?.click()} style={{
                width: "100%", padding: "12px", borderRadius: 14, border: `2px dashed ${P.border}`,
                background: "transparent", color: P.accent, fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>
                Choose File
              </button>
              <button onClick={() => setShowUpload(null)} style={{
                marginTop: 10, background: "none", border: "none", color: P.textTer,
                fontSize: 13, cursor: "pointer",
              }}>
                Skip for now
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (!activeChat) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: P.bg, minHeight: "100vh" }}>
        <style>{fonts}</style>

        <div style={{ padding: "28px 24px 12px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: P.textTer, marginBottom: 6 }}>
              Reading Companion
            </div>
            <h1 data-tour="home-header" style={{ fontFamily: "'Source Serif 4', serif", fontSize: 26, fontWeight: 700, margin: 0, color: P.text }}>
              Conversations
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {username && (
              <span style={{ fontSize: 13, color: P.textSec, fontWeight: 500 }}>
                {username}
              </span>
            )}
            {onLogout && (
              <button onClick={onLogout} style={{
                background: "none", border: `1px solid ${P.border}`, borderRadius: 8,
                padding: "6px 14px", fontSize: 12, color: P.textSec, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}>Log out</button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}><TypingDots /></div>
        ) : (
          <div style={{ padding: "8px 0" }}>
            {books.map((b, i) => (
              <div
                key={b.id}
                {...(i === 0 ? { "data-tour": "book-thread" } : {})}
                onClick={() => setActiveChat(b.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 24px", cursor: "pointer",
                  borderBottom: i < books.length - 1 ? `1px solid ${P.borderLight}` : "none",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={e => e.currentTarget.style.background = P.accentSoft}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(135deg, ${P.accent}22, ${P.accent}44)`,
                  border: `2px solid ${P.accent}33`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, position: "relative",
                }}>
                  {b.cover_emoji || "📖"}
                  {b.status === "ready" && (
                    <div style={{
                      position: "absolute", bottom: 1, right: 1,
                      width: 10, height: 10, borderRadius: "50%",
                      background: P.online, border: `2px solid ${P.bg}`,
                    }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                    <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 15, fontWeight: 600, color: P.text }}>
                      {b.title}
                    </span>
                    <span style={{ fontSize: 11, color: P.textTer, flexShrink: 0, marginLeft: 8 }}>
                      {b.status === "processing" ? "Processing..." : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: P.textSec, marginBottom: 4 }}>
                    {b.author}
                  </div>
                  <div style={{
                    fontSize: 13, color: P.textSec, lineHeight: 1.4,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {b.last_message
                      ? b.last_message.replace(/\*\*/g, "").split("\n")[0].slice(0, 80)
                      : "Start a conversation..."}
                  </div>
                </div>

                <button
                  onClick={(e) => handleDeleteBook(b.id, e)}
                  title="Delete book"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: P.textTer, fontSize: 16, padding: 6, borderRadius: 8,
                    flexShrink: 0, opacity: 0.4, transition: "opacity 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "0.4"}
                >
                  {"×"}
                </button>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  {b.total_pages > 0 && b.current_page < b.total_pages && (
                    <>
                      <div style={{ position: "relative", width: 36, height: 36 }}>
                        <svg viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
                          <circle cx="18" cy="18" r="15" fill="none" stroke={P.borderLight} strokeWidth="3" />
                          <circle cx="18" cy="18" r="15" fill="none" stroke={P.accent}
                            strokeWidth="3" strokeLinecap="round"
                            strokeDasharray={`${(b.current_page / b.total_pages) * 94.2} 94.2`}
                          />
                        </svg>
                        <div style={{
                          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 8, fontWeight: 600, color: P.textSec,
                        }}>p.{b.current_page}</div>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: P.textTer }}>
                        /{b.total_pages}
                      </div>
                    </>
                  )}
                  {b.total_pages > 0 && b.current_page >= b.total_pages && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: P.textTer }}>
                      {b.total_pages} pg
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: "12px 24px" }}>
          <div
            data-tour="add-book"
            onClick={() => setShowAddBook(true)}
            style={{
              border: `2px dashed ${P.border}`, borderRadius: 16,
              padding: "18px", textAlign: "center", cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = P.accent; e.currentTarget.style.background = P.accentSoft; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ fontSize: 20, marginBottom: 2 }}>+</div>
            <div style={{ fontSize: 13, color: P.textSec }}>Add a new book</div>
          </div>
        </div>

        {showAddBook && <AddBookModal />}
        {showUpload && <UploadModal />}

        <TourGuide
          storageKey="rc-tour-home"
          steps={[
            {
              icon: "👋",
              title: "Welcome to Reading Companion!",
              description: "Let's take a quick tour so you know your way around. This only takes a few seconds.",
            },
            ...(books.length > 0 ? [{
              target: '[data-tour="book-thread"]',
              placement: "bottom",
              title: "Your Book Conversations",
              description: "Each book is a conversation thread. Tap one to start chatting about what you've read.",
            }] : []),
            {
              target: '[data-tour="add-book"]',
              placement: "top",
              title: "Add a Book",
              description: "Upload a PDF or EPUB, search for a book online, or just enter the title manually.",
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif", background: P.bg, minHeight: "100vh",
      display: "flex", flexDirection: "column",
    }}>
      <style>{fonts}</style>

      <div style={{
        background: P.surface, borderBottom: `1px solid ${P.border}`,
        padding: "10px 16px", display: "flex", alignItems: "center", gap: 12,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => { setActiveChat(null); setMessages([]); fetchBooks(); }}
          style={{
            background: "none", border: "none", fontSize: 22, cursor: "pointer",
            padding: "4px 8px 4px 0", color: P.accent, fontWeight: 500,
          }}
        >{"‹"}</button>

        <div style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg, ${P.accent}22, ${P.accent}44)`,
          border: `2px solid ${P.accent}33`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>{book?.cover_emoji || "📖"}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 15, fontWeight: 600 }}>{book?.title}</div>
          <div data-tour="page-indicator" style={{ fontSize: 11, color: P.textTer, display: "flex", alignItems: "center", gap: 4 }}>
            {editingPage ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                page <input value={pageInput} onChange={e => setPageInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handlePageUpdate(); if (e.key === "Escape") setEditingPage(false); }}
                  onBlur={handlePageUpdate}
                  autoFocus
                  style={{ width: 40, padding: "1px 4px", border: `1px solid ${P.border}`, borderRadius: 4, fontSize: 11, textAlign: "center" }}
                /> of {book?.total_pages || "?"} &middot; {book?.author}
              </span>
            ) : (
              <span onClick={() => { setEditingPage(true); setPageInput(String(book?.current_page || 1)); }} style={{ cursor: "pointer" }}>
                page {book?.current_page || 1} of {book?.total_pages || "?"} &middot; {book?.author}
              </span>
            )}
          </div>
        </div>

        {book?.total_pages > 0 && book.current_page < book.total_pages && (
          <div style={{ position: "relative", width: 36, height: 36, flexShrink: 0 }}>
            <svg viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="15" fill="none" stroke={P.borderLight} strokeWidth="3" />
              <circle cx="18" cy="18" r="15" fill="none" stroke={P.accent}
                strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${((book?.current_page || 0) / book.total_pages) * 94.2} 94.2`}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 8, fontWeight: 600, color: P.textSec,
            }}>{Math.round(((book?.current_page || 0) / book.total_pages) * 100)}%</div>
          </div>
        )}

        {book?.status !== "ready" && book?.total_pages === 0 && (
          <button onClick={() => setShowUpload(activeChat)} style={{
            padding: "6px 12px", borderRadius: 10, border: `1px solid ${P.accent}`,
            background: "transparent", color: P.accent, fontSize: 11, fontWeight: 600,
            cursor: "pointer",
          }}>Upload</button>
        )}

      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 8px" }}>
        {isEmpty && (
          <div style={{ padding: "24px 8px 16px", animation: "fadeUp .4s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{book?.cover_emoji || "📖"}</div>
              <div style={{
                fontFamily: "'Source Serif 4', serif", fontSize: 18, fontWeight: 600,
                color: P.text, marginBottom: 4,
              }}>Chat with {book?.title}</div>
              <div style={{ fontSize: 13, color: P.textSec, lineHeight: 1.5 }}>
                Ask anything about what you've read so far.<br />
                No spoilers beyond page {book?.current_page || 1}.
              </div>
            </div>

            <div data-tour="quick-actions" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {GENRE_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (p.text === "Catch me up") {
                      handleCatchup();
                    } else {
                      sendMessage(p.text);
                    }
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: P.surface, border: `1px solid ${P.border}`,
                    borderRadius: 14, padding: "12px 16px", cursor: "pointer",
                    fontSize: 14, color: P.text, textAlign: "left", width: "100%",
                    transition: "all .15s ease", fontFamily: "'DM Sans', sans-serif",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = P.accent;
                    e.currentTarget.style.background = P.accentSoft;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = P.border;
                    e.currentTarget.style.background = P.surface;
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{p.icon}</span>
                  <span>{p.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div key={i} style={{
              display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
              marginBottom: 10, animation: "fadeUp .3s ease",
            }}>
              {!isUser && (
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: `${P.accent}22`, border: `1.5px solid ${P.accent}33`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, marginRight: 8, marginTop: 2,
                }}>{book?.cover_emoji || "📖"}</div>
              )}
              <div style={{
                maxWidth: "82%", padding: "10px 14px",
                borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: isUser ? P.userBubble : P.aiBubble,
                color: isUser ? "#FFF" : P.text,
                fontSize: 14, lineHeight: 1.65,
                fontFamily: isUser ? "'DM Sans', sans-serif" : "'Source Serif 4', serif",
              }}>
                {formatMsg(msg.text)}
              </div>
            </div>
          );
        })}

        {typing && (
          <div style={{ display: "flex", marginBottom: 10, animation: "fadeUp .2s ease" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: `${P.accent}22`, border: `1.5px solid ${P.accent}33`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, marginRight: 8, marginTop: 2,
            }}>{book?.cover_emoji || "📖"}</div>
            <div style={{ padding: "10px 14px", borderRadius: "18px 18px 18px 4px", background: P.aiBubble }}>
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {!isEmpty && !typing && (
        <div style={{ padding: "0 16px 6px", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {GENRE_PROMPTS.filter(p => !messages.some(m => m.text === p.text)).slice(0, 2).map((p, i) => (
            <button
              key={i}
              onClick={() => {
                if (p.text === "Catch me up") {
                  handleCatchup();
                } else {
                  sendMessage(p.text);
                }
              }}
              style={{
                fontSize: 12, padding: "6px 12px", borderRadius: 20,
                border: `1px solid ${P.border}`, background: P.surface,
                color: P.textSec, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                transition: "all .15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = P.accent; e.currentTarget.style.color = P.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.color = P.textSec; }}
            >
              {p.icon} {p.text}
            </button>
          ))}
        </div>
      )}

      <div style={{
        position: "sticky", bottom: 0, background: P.bg,
        borderTop: `1px solid ${P.border}`, padding: "10px 16px 18px",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <input
            data-tour="chat-input"
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="Ask about what you've read..."
            style={{
              flex: 1, padding: "11px 16px", borderRadius: 24,
              border: `1.5px solid ${P.border}`, background: P.surface,
              fontSize: 14, outline: "none", transition: "border-color .2s ease",
              fontFamily: "'DM Sans', sans-serif", color: P.text,
            }}
            onFocus={e => e.target.style.borderColor = P.accent}
            onBlur={e => e.target.style.borderColor = P.border}
          />
          <button
            data-tour="voice-mode"
            onClick={() => setShowVoiceMode(true)}
            style={{
              width: 42, height: 42, borderRadius: "50%", border: "none",
              background: P.accentSoft, color: P.accent,
              fontSize: 18, cursor: "pointer", flexShrink: 0,
              transition: "all .2s ease", display: "flex", alignItems: "center",
              justifyContent: "center",
            }}
          >{"🎙"}</button>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || typing}
            style={{
              width: 42, height: 42, borderRadius: "50%", border: "none",
              background: input.trim() && !typing ? P.accent : P.border,
              color: "#FFF", fontSize: 18, cursor: input.trim() && !typing ? "pointer" : "default",
              transition: "all .2s ease", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0,
            }}
          >{"↑"}</button>
        </div>
      </div>

      {showUpload && <UploadModal />}

      {showVoiceMode && book && (
        <VoiceMode
          book={book}
          apiBase={API}
          onClose={() => { setShowVoiceMode(false); fetchMessages(activeChat); }}
        />
      )}

      <TourGuide
        storageKey="rc-tour-chat"
        steps={[
          {
            target: '[data-tour="page-indicator"]',
            placement: "bottom",
            icon: "📖",
            title: "Spoiler-Free Reading",
            description: "Tap here to set your current page. The AI will only reference content up to where you are — no spoilers.",
          },
          ...(isEmpty ? [{
            target: '[data-tour="quick-actions"]',
            placement: "top",
            title: "Quick Actions",
            description: "Use these shortcuts to catch up on where you left off, get an explanation, or start a discussion.",
          }] : []),
          {
            target: '[data-tour="chat-input"]',
            placement: "top",
            title: "Ask Anything",
            description: "Type any question about what you've read. It's like texting a friend who's read the same book.",
          },
          {
            target: '[data-tour="voice-mode"]',
            placement: "top",
            icon: "🎙",
            title: "Voice Mode",
            description: "Tap the mic for a hands-free voice conversation about your book.",
          },
        ]}
      />

      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(8px) }
          to { opacity:1; transform:translateY(0) }
        }
      `}</style>
    </div>
  );
}
