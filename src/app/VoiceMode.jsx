import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export default function VoiceMode({ book, apiBase, onClose }) {
  const [state, setState] = useState("init");
  const [volume, setVolume] = useState(0);
  const [aiText, setAiText] = useState("");
  const [userText, setUserText] = useState("");

  const audioRef = useRef(null);
  const audioQueueRef = useRef([]);
  const playingRef = useRef(false);
  const abortRef = useRef(null);
  const activeRef = useRef(true);
  const stateRef = useRef("init");
  const streamDoneRef = useRef(true);
  const streamRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const speechStartRef = useRef(0);
  const silenceTimerRef = useRef(null);
  const speakingRef = useRef(false);

  const P = {
    bg: "#1A1714", surface: "#2A2520", border: "#3A3530",
    text: "#F6F3EE", textSec: "#AEA393", accent: "#C4956A",
  };

  const setStateAndRef = (s) => { stateRef.current = s; setState(s); };

  // --- Audio playback queue ---
  const playNextInQueue = useCallback(() => {
    if (!activeRef.current) return;
    if (audioQueueRef.current.length === 0) {
      playingRef.current = false;
      if (streamDoneRef.current) {
        setStateAndRef("listening");
      }
      return;
    }
    playingRef.current = true;
    const url = audioQueueRef.current.shift();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      audioRef.current = null;
      playNextInQueue();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      audioRef.current = null;
      playNextInQueue();
    };
    audio.play().catch(() => playNextInQueue());
  }, []);

  const queueTTS = useCallback(async (text) => {
    try {
      const cleanText = text.replace(/\*\*/g, "").replace(/#+\s/g, "").trim();
      if (!cleanText) return;
      const res = await fetch(`${apiBase}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioQueueRef.current.push(url);
      if (!playingRef.current) {
        playNextInQueue();
      }
    } catch (e) {
      console.error("TTS error:", e);
    }
  }, [apiBase, playNextInQueue]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    audioQueueRef.current.forEach(url => URL.revokeObjectURL(url));
    audioQueueRef.current = [];
    playingRef.current = false;
    streamDoneRef.current = true;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  // --- Send to AI with sentence-by-sentence TTS streaming ---
  const sendToAI = useCallback(async (text) => {
    setStateAndRef("thinking");
    streamDoneRef.current = false;
    setAiText("");
    setUserText(text);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${apiBase}/books/${book.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, voice: true }),
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let spokenUpTo = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!activeRef.current) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              fullText += data.text;
              setAiText(fullText);

              let unspoken = fullText.slice(spokenUpTo);
              let sentenceEnd;
              while ((sentenceEnd = unspoken.search(/[.!?]\s/)) !== -1) {
                const sentence = unspoken.slice(0, sentenceEnd + 1);
                spokenUpTo += sentenceEnd + 1;
                setStateAndRef("speaking");
                queueTTS(sentence);
                unspoken = fullText.slice(spokenUpTo);
              }
            }
          } catch {}
        }
      }

      abortRef.current = null;
      streamDoneRef.current = true;

      const remaining = fullText.slice(spokenUpTo).trim();
      if (remaining && activeRef.current) {
        setStateAndRef("speaking");
        queueTTS(remaining);
      } else if (!playingRef.current && audioQueueRef.current.length === 0) {
        setStateAndRef("listening");
      }
    } catch (e) {
      if (e.name !== "AbortError") console.error("AI error:", e);
      streamDoneRef.current = true;
      if (activeRef.current) setStateAndRef("listening");
    }
  }, [apiBase, book.id, queueTTS]);

  // --- Transcribe audio ---
  const transcribeAndSend = useCallback(async (blob) => {
    if (!activeRef.current) return;
    setStateAndRef("thinking");
    try {
      const form = new FormData();
      form.append("file", blob, "speech.webm");
      const res = await fetch(`${apiBase}/transcribe`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.text && data.text.trim()) {
        sendToAI(data.text.trim());
      } else {
        if (activeRef.current) setStateAndRef("listening");
      }
    } catch (e) {
      console.error("Transcription error:", e);
      if (activeRef.current) setStateAndRef("listening");
    }
  }, [apiBase, sendToAI]);

  // --- Mic setup (runs once) ---
  useEffect(() => {
    const SPEECH_THRESHOLD = 0.04;
    const SILENCE_DURATION = 800;
    const MIN_SPEECH_MS = 600;

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        streamRef.current = stream;

        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.85;
        source.connect(analyser);

        const dataArray = new Float32Array(analyser.fftSize);

        function tick() {
          if (!activeRef.current) return;
          analyser.getFloatTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i] * dataArray[i];
          const rms = Math.sqrt(sum / dataArray.length);
          setVolume(Math.min(rms * 4, 1));

          const canListen = stateRef.current === "listening";

          if (rms > SPEECH_THRESHOLD && canListen) {
            if (!speakingRef.current) {
              speakingRef.current = true;
              speechStartRef.current = Date.now();
              chunksRef.current = [];
              try {
                const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                  ? "audio/webm;codecs=opus" : "audio/webm";
                const rec = new MediaRecorder(stream, { mimeType });
                rec.ondataavailable = (e) => {
                  if (e.data.size > 0) chunksRef.current.push(e.data);
                };
                rec.onstop = () => {
                  const duration = Date.now() - speechStartRef.current;
                  if (duration >= MIN_SPEECH_MS && chunksRef.current.length > 0 && activeRef.current) {
                    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                    transcribeAndSend(blob);
                  } else {
                    if (activeRef.current) setStateAndRef("listening");
                  }
                  speakingRef.current = false;
                };
                rec.start(100);
                recorderRef.current = rec;
              } catch (e) {
                console.error("Recorder error:", e);
                speakingRef.current = false;
              }
            }
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else if (speakingRef.current && rms <= SPEECH_THRESHOLD) {
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                silenceTimerRef.current = null;
                if (recorderRef.current && recorderRef.current.state === "recording") {
                  recorderRef.current.stop();
                }
              }, SILENCE_DURATION);
            }
          }

          // Interrupt: user speaks while AI is playing
          if (rms > SPEECH_THRESHOLD && (stateRef.current === "speaking") && !speakingRef.current) {
            stopPlayback();
            setStateAndRef("listening");
            setAiText("");
          }

          rafRef.current = requestAnimationFrame(tick);
        }

        setStateAndRef("listening");
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        console.error("Mic setup failed:", e);
        setStateAndRef("error");
      }
    }

    activeRef.current = true;
    setup();

    return () => {
      activeRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.stop();
      }
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (ctxRef.current) ctxRef.current.close();
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => {
    activeRef.current = false;
    stopPlayback();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recorderRef.current && recorderRef.current.state === "recording") recorderRef.current.stop();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (ctxRef.current) ctxRef.current.close();
    onClose();
  };

  const handleInterrupt = () => {
    stopPlayback();
    setStateAndRef("listening");
    setAiText("");
  };

  const handleOrbTap = (e) => {
    e.stopPropagation();
    if (state === "speaking") {
      handleInterrupt();
    } else if (state === "listening" && speakingRef.current && recorderRef.current && recorderRef.current.state === "recording") {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      recorderRef.current.stop();
    }
  };

  const baseSize = 180;
  const pulseAdd = state === "listening" ? volume * 60 : 0;
  const ringColor = state === "listening" ? P.accent
    : state === "thinking" ? "#7A6F60"
    : state === "speaking" ? "#5B9A5F"
    : P.accent;
  const statusText = state === "listening" ? "Listening..."
    : state === "thinking" ? "Thinking..."
    : state === "speaking" ? "Speaking..."
    : state === "error" ? "Mic access denied"
    : "";

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, width: "100vw", height: "100vh",
      background: P.bg, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @keyframes think {
          0%, 100% { opacity: 0.3; transform: scale(0.94); }
          50% { opacity: 0.8; transform: scale(1.06); }
        }
        @keyframes speak {
          0%, 100% { transform: scale(1); }
          30% { transform: scale(1.04); }
          60% { transform: scale(0.96); }
        }
      `}</style>

      {/* Close */}
      <button onClick={(e) => { e.stopPropagation(); handleClose(); }} style={{
        position: "absolute", top: 16, left: 20,
        background: "none", border: "none", color: P.textSec,
        fontSize: 15, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        zIndex: 10, padding: "8px",
      }}>
        ✕
      </button>

      {/* Book */}
      <div style={{
        position: "absolute", top: 20, right: 20,
        fontSize: 12, color: P.textSec,
      }}>
        {book?.cover_emoji} {book?.title}
      </div>

      {/* User said */}
      {userText && (state === "thinking" || state === "speaking") && (
        <div style={{
          position: "absolute", top: 70, left: 0, right: 0,
          textAlign: "center", padding: "0 32px",
          fontSize: 14, color: P.textSec, fontStyle: "italic",
          opacity: 0.6,
        }}>
          "{userText}"
        </div>
      )}

      {/* Outer glow ring */}
      <div onClick={handleOrbTap} style={{
        width: baseSize + pulseAdd + 40, height: baseSize + pulseAdd + 40,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${ringColor}15, transparent 70%)`,
        transition: state === "listening" ? "all 0.06s" : "all 0.5s ease",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: (state === "listening" || state === "speaking") ? "pointer" : "default",
        animation: state === "thinking" ? "think 2s ease-in-out infinite"
          : state === "speaking" ? "speak 1.2s ease-in-out infinite"
          : "none",
      }}>
        {/* Main ring */}
        <div style={{
          width: baseSize + pulseAdd, height: baseSize + pulseAdd,
          borderRadius: "50%",
          border: `2px solid ${ringColor}88`,
          background: `radial-gradient(circle at 40% 35%, ${ringColor}30, ${ringColor}08)`,
          boxShadow: `0 0 ${30 + volume * 50}px ${ringColor}40`,
          transition: state === "listening" ? "all 0.06s" : "all 0.5s ease",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {/* Inner fill */}
          <div style={{
            width: 50 + volume * 50, height: 50 + volume * 50,
            borderRadius: "50%",
            background: `${ringColor}${state === "listening" ? "55" : "25"}`,
            transition: state === "listening" ? "all 0.06s" : "all 0.5s ease",
          }} />
        </div>
      </div>

      {/* Status */}
      <div style={{
        marginTop: 28, fontSize: 16, color: P.text,
        fontWeight: 500,
      }}>
        {statusText}
      </div>

      {/* AI response text */}
      {aiText && (state === "thinking" || state === "speaking") && (
        <div style={{
          marginTop: 16, maxWidth: 340, textAlign: "center",
          padding: "0 24px", fontSize: 13, color: P.textSec,
          lineHeight: 1.7, maxHeight: 150, overflow: "hidden",
        }}>
          {aiText.length > 250 ? "..." + aiText.slice(-250) : aiText}
        </div>
      )}

      {/* Bottom hint */}
      <div style={{
        position: "absolute", bottom: 32,
        fontSize: 12, color: P.border, textAlign: "center",
      }}>
        {state === "speaking" ? "Tap orb to interrupt" :
         state === "listening" ? "Tap orb when done talking" : ""}
      </div>
    </div>,
    document.body
  );
}
