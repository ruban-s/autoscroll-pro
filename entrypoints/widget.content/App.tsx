import { useState, useEffect, useRef } from "react";
import type { ScrollState } from "@/types";
import { defaultConfig, widgetPosition, widgetVisible } from "@/utils/storage";

export default function App() {
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(30);
  const [progress, setProgress] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pos, setPos] = useState({ x: 16, y: 100 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    defaultConfig.getValue().then((c) => setSpeed(c.speed)).catch(() => {});
    widgetVisible.getValue().then(setVisible).catch(() => {});
    widgetPosition.getValue().then((p) => {
      setPos({
        x: p.x < 0 ? window.innerWidth - 80 : p.x,
        y: p.y < 0 ? window.innerHeight - 200 : p.y,
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (message: any) => {
      if (message.type === "scroll:stateChanged") {
        const s = message.data as ScrollState;
        setScrolling(s.isScrolling);
        setSpeed(s.currentSpeed);
        setProgress(s.progress);
      }
      if (message.type === "widget:toggle") {
        setVisible((v) => !v);
      }
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 56, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 56, e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onDragStart = (e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  const toggle = async () => {
    const config = await defaultConfig.getValue();
    if (scrolling) {
      browser.runtime.sendMessage({ type: "scroll:stop" }).catch(() => {});
    } else {
      browser.runtime.sendMessage({ type: "scroll:start", data: config }).catch(() => {});
    }
  };

  const changeSpeed = (delta: number) => {
    const newSpeed = Math.max(1, Math.min(100, speed + delta));
    setSpeed(newSpeed);
    browser.runtime.sendMessage({ type: "scroll:updateConfig", data: { speed: newSpeed } }).catch(() => {});
  };

  if (!visible) return null;

  const circumference = 2 * Math.PI * 22;
  const strokeDash = (progress / 100) * circumference;

  return (
    <div
      onMouseDown={onDragStart}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 2147483647,
        cursor: "grab",
        userSelect: "none",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{
        background: "#1a1a2e",
        borderRadius: 16,
        padding: minimized ? 8 : 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        border: "1px solid rgba(255,255,255,0.1)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}>
        <div style={{ position: "relative", width: 48, height: 48 }}>
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
            <circle
              cx="24" cy="24" r="22"
              fill="none"
              stroke={scrolling ? "#10b981" : "rgba(255,255,255,0.2)"}
              strokeWidth="3"
              strokeDasharray={`${strokeDash} ${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 24 24)"
              style={{ transition: "stroke-dasharray 0.3s" }}
            />
          </svg>
          <button
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            style={{
              position: "absolute",
              inset: 0,
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: scrolling ? "#ef4444" : "#10b981",
              fontSize: 20,
            }}
          >
            {scrolling ? "⏸" : "▶"}
          </button>
        </div>

        {!minimized && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Btn onClick={() => changeSpeed(-5)}>−</Btn>
              <span style={{ color: "#fff", fontSize: 13, fontVariantNumeric: "tabular-nums", width: 24, textAlign: "center" }}>
                {speed}
              </span>
              <Btn onClick={() => changeSpeed(5)}>+</Btn>
            </div>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
              {Math.round(progress)}%
            </span>
          </>
        )}

        <Btn onClick={() => setMinimized(!minimized)} style={{ fontSize: 10, padding: "2px 6px" }}>
          {minimized ? "▼" : "▲"}
        </Btn>
      </div>
    </div>
  );
}

function Btn({ onClick, children, style }: { onClick: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        background: "rgba(255,255,255,0.1)",
        border: "none",
        borderRadius: 6,
        color: "#fff",
        cursor: "pointer",
        padding: "4px 8px",
        fontSize: 14,
        lineHeight: 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
