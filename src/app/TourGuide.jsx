import { useState, useEffect, useCallback, useRef } from "react";

const P = {
  accent: "#6B4D30",
  accentSoft: "#EDE0D1",
  text: "#1A1714",
  textSec: "#7A6F60",
  surface: "#FFFFFF",
  border: "#E5DDD2",
};

function getTargetRect(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function calcPosition(rect, placement, tooltipW, tooltipH) {
  const pad = 14;
  const arrowSize = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top, left, arrowStyle, arrowDir;

  if (placement === "bottom") {
    top = rect.bottom + pad;
    left = rect.left + rect.width / 2 - tooltipW / 2;
    arrowDir = "up";
  } else if (placement === "top") {
    top = rect.top - tooltipH - pad;
    left = rect.left + rect.width / 2 - tooltipW / 2;
    arrowDir = "down";
  } else if (placement === "left") {
    top = rect.top + rect.height / 2 - tooltipH / 2;
    left = rect.left - tooltipW - pad;
    arrowDir = "right";
  } else {
    top = rect.top + rect.height / 2 - tooltipH / 2;
    left = rect.right + pad;
    arrowDir = "left";
  }

  if (left < 12) left = 12;
  if (left + tooltipW > vw - 12) left = vw - tooltipW - 12;
  if (top < 12) top = 12;
  if (top + tooltipH > vh - 12) top = vh - tooltipH - 12;

  const arrowLeft = Math.min(Math.max(rect.left + rect.width / 2 - left - arrowSize, 12), tooltipW - 24);
  const arrowTop = Math.min(Math.max(rect.top + rect.height / 2 - top - arrowSize, 12), tooltipH - 24);

  if (arrowDir === "up") {
    arrowStyle = {
      position: "absolute", top: -arrowSize, left: arrowLeft,
      width: 0, height: 0,
      borderLeft: `${arrowSize}px solid transparent`,
      borderRight: `${arrowSize}px solid transparent`,
      borderBottom: `${arrowSize}px solid ${P.surface}`,
    };
  } else if (arrowDir === "down") {
    arrowStyle = {
      position: "absolute", bottom: -arrowSize, left: arrowLeft,
      width: 0, height: 0,
      borderLeft: `${arrowSize}px solid transparent`,
      borderRight: `${arrowSize}px solid transparent`,
      borderTop: `${arrowSize}px solid ${P.surface}`,
    };
  } else if (arrowDir === "left") {
    arrowStyle = {
      position: "absolute", left: -arrowSize, top: arrowTop,
      width: 0, height: 0,
      borderTop: `${arrowSize}px solid transparent`,
      borderBottom: `${arrowSize}px solid transparent`,
      borderRight: `${arrowSize}px solid ${P.surface}`,
    };
  } else {
    arrowStyle = {
      position: "absolute", right: -arrowSize, top: arrowTop,
      width: 0, height: 0,
      borderTop: `${arrowSize}px solid transparent`,
      borderBottom: `${arrowSize}px solid transparent`,
      borderLeft: `${arrowSize}px solid ${P.surface}`,
    };
  }

  return { top, left, arrowStyle };
}

export default function TourGuide({ steps, storageKey, onComplete }) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [pos, setPos] = useState(null);
  const [targetRect, setTargetRect] = useState(null);
  const tooltipRef = useRef(null);

  const active = currentStep >= 0 && currentStep < steps.length;
  const step = active ? steps[currentStep] : null;

  useEffect(() => {
    const seen = localStorage.getItem(storageKey);
    if (!seen) {
      const timer = setTimeout(() => setCurrentStep(0), 600);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const measure = useCallback(() => {
    if (!step) return;
    if (!step.target) {
      setTargetRect(null);
      setPos(null);
      return;
    }
    const rect = getTargetRect(step.target);
    if (!rect) {
      setTargetRect(null);
      setPos(null);
      return;
    }
    setTargetRect(rect);
    const tooltipEl = tooltipRef.current;
    if (tooltipEl) {
      const tooltipW = tooltipEl.offsetWidth;
      const tooltipH = tooltipEl.offsetHeight;
      setPos(calcPosition(rect, step.placement || "bottom", tooltipW, tooltipH));
    }
  }, [step]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure, currentStep]);

  useEffect(() => {
    if (active) {
      const t = setTimeout(measure, 50);
      return () => clearTimeout(t);
    }
  }, [active, measure]);

  const finish = useCallback(() => {
    localStorage.setItem(storageKey, "true");
    setCurrentStep(-1);
    onComplete?.();
  }, [storageKey, onComplete]);

  const next = () => {
    if (currentStep >= steps.length - 1) {
      finish();
    } else {
      setCurrentStep(s => s + 1);
    }
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  if (!active) return null;

  const highlightPad = 6;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
      <style>{`
        @keyframes tourFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tourPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(107,77,48,0.3); }
          50% { box-shadow: 0 0 0 6px rgba(107,77,48,0.1); }
        }
      `}</style>

      <div
        onClick={finish}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.45)",
          transition: "opacity 0.3s ease",
        }}
      />

      {targetRect && (
        <div style={{
          position: "absolute",
          top: targetRect.top - highlightPad,
          left: targetRect.left - highlightPad,
          width: targetRect.width + highlightPad * 2,
          height: targetRect.height + highlightPad * 2,
          borderRadius: 14,
          background: "transparent",
          boxShadow: `0 0 0 9999px rgba(0,0,0,0.45)`,
          animation: "tourPulse 2s ease-in-out infinite",
          pointerEvents: "none",
          transition: "all 0.3s ease",
        }} />
      )}

      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          top: step.target && pos ? pos.top : "50%",
          left: step.target && pos ? pos.left : "50%",
          transform: step.target && pos ? "none" : "translate(-50%, -50%)",
          width: 290,
          maxWidth: "calc(100vw - 32px)",
          background: P.surface,
          borderRadius: 16,
          padding: "20px 22px 16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          animation: "tourFadeIn 0.25s ease",
          zIndex: 1,
        }}
      >
        {step.target && pos && <div style={pos.arrowStyle} />}

        {step.icon && (
          <div style={{ fontSize: 28, marginBottom: 8 }}>{step.icon}</div>
        )}
        <div style={{
          fontFamily: "'Source Serif 4', serif",
          fontSize: 16, fontWeight: 600, color: P.text,
          marginBottom: 6,
        }}>
          {step.title}
        </div>
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13, color: P.textSec, lineHeight: 1.6,
          marginBottom: 18,
        }}>
          {step.description}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                width: i === currentStep ? 18 : 6, height: 6, borderRadius: 3,
                background: i === currentStep ? P.accent : P.border,
                transition: "all 0.2s ease",
              }} />
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {currentStep > 0 && (
              <button onClick={prev} style={{
                background: "none", border: "none",
                color: P.textSec, fontSize: 13, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", padding: "6px 10px",
              }}>
                Back
              </button>
            )}
            {currentStep === 0 && (
              <button onClick={finish} style={{
                background: "none", border: "none",
                color: P.textSec, fontSize: 13, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", padding: "6px 10px",
              }}>
                Skip
              </button>
            )}
            <button onClick={next} style={{
              background: P.accent, color: "#FFF", border: "none",
              borderRadius: 10, padding: "8px 18px", fontSize: 13,
              fontWeight: 600, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              transition: "background 0.15s ease",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#7D5A38"}
              onMouseLeave={e => e.currentTarget.style.background = P.accent}
            >
              {currentStep >= steps.length - 1 ? "Got it!" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
