import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Gauge,
  Settings,
} from "lucide-react";
import { defaultConfig } from "@/utils/storage";
import { DEFAULT_CONFIG } from "@/utils/constants";
import type { ScrollConfig, ScrollDirection, ScrollState } from "@/types";

const DIRECTION_ICONS = {
  down: ArrowDown,
  up: ArrowUp,
  left: ArrowLeft,
  right: ArrowRight,
} as const;

export default function App() {
  const [config, setConfig] = useState<ScrollConfig>(DEFAULT_CONFIG);
  const [scrolling, setScrolling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    defaultConfig
      .getValue()
      .then(setConfig)
      .catch((e) => setError(String(e)));
  }, []);

  const sendToBackground = useCallback(
    async (type: string, data?: unknown) => {
      try {
        return await browser.runtime.sendMessage({ type, data });
      } catch {
        return null;
      }
    },
    [],
  );

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

  const pollState = useCallback(() => {
    sendToTab("scroll:getState").then((state) => {
      if (state) {
        const s = state as ScrollState;
        setScrolling(s.isScrolling);
        setProgress(s.progress);
      }
    });
  }, [sendToTab]);

  useEffect(() => {
    pollState();
    const id = setInterval(pollState, 500);
    return () => clearInterval(id);
  }, [pollState]);

  const toggleScroll = async () => {
    if (!config) return;
    if (scrolling) {
      await sendToBackground("scroll:stop");
    } else {
      await sendToBackground("scroll:start", config);
    }
    setTimeout(pollState, 100);
  };

  const updateSpeed = async (speed: number) => {
    if (!config) return;
    const updated = { ...config, speed };
    setConfig(updated);
    await defaultConfig.setValue(updated);
    if (scrolling) {
      await sendToBackground("scroll:updateConfig", { speed });
    }
  };

  const updateDirection = async (direction: ScrollDirection) => {
    if (!config) return;
    const updated = { ...config, direction };
    setConfig(updated);
    await defaultConfig.setValue(updated);
    if (scrolling) {
      await sendToBackground("scroll:updateConfig", { direction });
    }
  };

  if (error) {
    return (
      <div className="p-4 text-red-500 text-sm">
        <p>Error loading config:</p>
        <pre className="mt-2 text-xs whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">AutoScroll Pro</h1>
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
          <Gauge size={16} className="text-gray-500 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Speed</span>
          <span className="ml-auto text-sm font-mono text-gray-900 dark:text-gray-100">
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
        <span className="text-sm text-gray-600 dark:text-gray-400">Direction</span>
        <div className="flex gap-2">
          {(Object.keys(DIRECTION_ICONS) as ScrollDirection[]).map((dir) => {
            const Icon = DIRECTION_ICONS[dir];
            return (
              <button
                key={dir}
                onClick={() => updateDirection(dir)}
                className={`flex-1 p-2 rounded-lg border transition-colors flex items-center justify-center ${
                  config.direction === dir
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
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
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
        <span>Alt+S toggle · Alt+↑↓ speed</span>
        <button
          onClick={() => browser.runtime.openOptionsPage()}
          className="p-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}
