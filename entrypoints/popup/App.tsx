import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Gauge,
} from "lucide-react";
import { defaultConfig } from "@/utils/storage";
import type { ScrollConfig, ScrollDirection, ScrollState } from "@/types";

const DIRECTION_ICONS = {
  down: ArrowDown,
  up: ArrowUp,
  left: ArrowLeft,
  right: ArrowRight,
} as const;

export default function App() {
  const [config, setConfig] = useState<ScrollConfig | null>(null);
  const [scrolling, setScrolling] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    defaultConfig.getValue().then(setConfig);
  }, []);

  const sendToTab = useCallback(
    async (type: string, data?: unknown) => {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) return null;
      try {
        return await browser.tabs.sendMessage(tab.id, { type, data });
      } catch {
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    sendToTab("scroll:getState").then((state) => {
      if (state) {
        const s = state as ScrollState;
        setScrolling(s.isScrolling);
        setProgress(s.progress);
      }
    });
  }, [sendToTab]);

  const toggleScroll = async () => {
    if (!config) return;
    if (scrolling) {
      await sendToTab("scroll:stop");
      setScrolling(false);
    } else {
      await sendToTab("scroll:start", config);
      setScrolling(true);
    }
  };

  const updateSpeed = async (speed: number) => {
    if (!config) return;
    const updated = { ...config, speed };
    setConfig(updated);
    await defaultConfig.setValue(updated);
    if (scrolling) {
      await sendToTab("scroll:updateConfig", { speed });
    }
  };

  const updateDirection = async (direction: ScrollDirection) => {
    if (!config) return;
    const updated = { ...config, direction };
    setConfig(updated);
    await defaultConfig.setValue(updated);
    if (scrolling) {
      await sendToTab("scroll:updateConfig", { direction });
    }
  };

  if (!config) return null;

  return (
    <div className="p-4 space-y-4 bg-white">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">AutoScroll Pro</h1>
        <button
          onClick={toggleScroll}
          className={`p-3 rounded-full transition-colors ${
            scrolling
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-emerald-500 hover:bg-emerald-600 text-white"
          }`}
        >
          {scrolling ? <Pause size={20} /> : <Play size={20} />}
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-gray-500" />
          <span className="text-sm text-gray-600">Speed</span>
          <span className="ml-auto text-sm font-mono text-gray-900">
            {config.speed}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          value={config.speed}
          onChange={(e) => updateSpeed(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
      </div>

      <div className="space-y-2">
        <span className="text-sm text-gray-600">Direction</span>
        <div className="flex gap-2">
          {(Object.keys(DIRECTION_ICONS) as ScrollDirection[]).map((dir) => {
            const Icon = DIRECTION_ICONS[dir];
            return (
              <button
                key={dir}
                onClick={() => updateDirection(dir)}
                className={`flex-1 p-2 rounded-lg border transition-colors flex items-center justify-center ${
                  config.direction === dir
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>
      </div>

      {scrolling && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
        Alt+S to toggle · Alt+↑↓ for speed
      </div>
    </div>
  );
}
