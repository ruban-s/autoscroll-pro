import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play,
  Pause,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { sendMessage, onMessage } from "@/utils/messaging";
import { defaultConfig, widgetPosition } from "@/utils/storage";
import type { ScrollConfig, ScrollDirection, ScrollState } from "@/types";

const DIRECTION_ICONS = {
  down: ChevronDown,
  up: ChevronUp,
  left: ChevronLeft,
  right: ChevronRight,
} as const;

export default function App() {
  const [config, setConfig] = useState<ScrollConfig | null>(null);
  const [state, setState] = useState<ScrollState | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 20, y: 20 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    defaultConfig.getValue().then(setConfig);
    widgetPosition.getValue().then(setPos);
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const x = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y));
      setPos({ x, y });
    };

    const handleUp = () => {
      if (dragging.current) {
        dragging.current = false;
        widgetPosition.setValue(pos);
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [pos]);

  const pollState = useCallback(async () => {
    try {
      const s = await sendMessage("scroll:getState", undefined);
      if (s) setState(s as ScrollState);
    } catch {}
  }, []);

  useEffect(() => {
    pollState();
    const id = setInterval(pollState, 1000);
    return () => clearInterval(id);
  }, [pollState]);

  const handleDragStart = (e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    e.preventDefault();
  };

  const toggleScroll = async () => {
    if (!config) return;
    if (state?.isScrolling) {
      await sendMessage("scroll:stop", undefined);
    } else {
      await sendMessage("scroll:start", config);
    }
    pollState();
  };

  const changeSpeed = async (delta: number) => {
    if (!config) return;
    const speed = Math.max(1, Math.min(100, config.speed + delta));
    const updated = { ...config, speed };
    setConfig(updated);
    await defaultConfig.setValue(updated);
    await sendMessage("scroll:updateConfig", { speed });
  };

  const changeDirection = async (direction: ScrollDirection) => {
    if (!config) return;
    const updated = { ...config, direction };
    setConfig(updated);
    await defaultConfig.setValue(updated);
    await sendMessage("scroll:updateConfig", { direction });
  };

  if (!config) return null;

  const isScrolling = state?.isScrolling ?? false;
  const progress = state?.progress ?? 0;

  const progressDeg = (progress / 100) * 360;

  return (
    <div
      ref={containerRef}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[2147483647] select-none"
    >
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          className="flex items-center justify-center gap-1 py-1 cursor-grab active:cursor-grabbing bg-gray-800 hover:bg-gray-750"
        >
          <GripVertical size={12} className="text-gray-500" />
          <button
            onClick={() => setMinimized(!minimized)}
            className="p-0.5 hover:text-emerald-400 transition-colors"
          >
            {minimized ? <Maximize2 size={10} /> : <Minimize2 size={10} />}
          </button>
        </div>

        <div className="px-3 pb-3 pt-1">
          {/* Play button with progress ring */}
          <div className="flex items-center justify-center mb-2">
            <div className="relative">
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle
                  cx="24"
                  cy="24"
                  r="21"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="3"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="21"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeDasharray={`${(progressDeg / 360) * 132} 132`}
                  strokeLinecap="round"
                  transform="rotate(-90 24 24)"
                  className="transition-all duration-300"
                />
              </svg>
              <button
                onClick={toggleScroll}
                className="absolute inset-0 flex items-center justify-center hover:scale-110 transition-transform"
              >
                {isScrolling ? (
                  <Pause size={18} className="text-red-400" />
                ) : (
                  <Play size={18} className="text-emerald-400 ml-0.5" />
                )}
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Speed control */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => changeSpeed(-5)}
                  className="p-1 rounded hover:bg-gray-700 transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="text-xs font-mono tabular-nums w-8 text-center">
                  {config.speed}
                </span>
                <button
                  onClick={() => changeSpeed(5)}
                  className="p-1 rounded hover:bg-gray-700 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Direction */}
              <div className="grid grid-cols-4 gap-1">
                {(Object.keys(DIRECTION_ICONS) as ScrollDirection[]).map(
                  (dir) => {
                    const Icon = DIRECTION_ICONS[dir];
                    return (
                      <button
                        key={dir}
                        onClick={() => changeDirection(dir)}
                        className={`p-1 rounded transition-colors ${
                          config.direction === dir
                            ? "bg-emerald-600 text-white"
                            : "hover:bg-gray-700 text-gray-400"
                        }`}
                      >
                        <Icon size={14} className="mx-auto" />
                      </button>
                    );
                  },
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
