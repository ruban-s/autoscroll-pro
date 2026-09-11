import type { ContentType, ResumePosition, ScrollConfig, ScrollState } from "@/types";
import { RESUME_POSITION_MAX_AGE_MS } from "@/utils/constants";
import { matchProfile } from "@/utils/profiler";
import {
  defaultConfig,
  profiles,
  resumePositions,
  speedZones,
  tabAutoStartPending,
  tabContentTypes,
  tabNextChapter,
} from "@/utils/storage";

// The MV3 worker is evicted while idle, so its Maps cannot be trusted for
// toggle state — ask the page, which is the only durable source.
async function isTabScrolling(tabId: number): Promise<boolean> {
  try {
    const state = await browser.tabs.sendMessage(tabId, {
      type: "scroll:getState",
    });
    return (state as ScrollState | undefined)?.isScrolling === true;
  } catch {
    return false;
  }
}

// Firefox for Android exposes `action` without badge support; swallow the
// rejection rather than let it kill the surrounding handler.
async function setBadge(tabId: number, text: string, color?: string) {
  try {
    await browser.action.setBadgeText({ text, tabId });
    if (color) await browser.action.setBadgeBackgroundColor({ color, tabId });
  } catch {}
}

async function zoneSpeedFor(tabId: number): Promise<number | undefined> {
  const types = await tabContentTypes.getValue();
  const type = types[tabId];
  if (!type) return undefined;
  const zones = await speedZones.getValue();
  return zones[type];
}

export default defineBackground(() => {
  // Firefox for Android implements neither menus nor commands; touching either
  // at top level throws and takes the whole background script down with it.
  const hasContextMenus = typeof browser.contextMenus !== "undefined";
  const hasCommands = typeof browser.commands !== "undefined";

  async function startScroll(tabId: number, config: Partial<ScrollConfig>) {
    const speed = await zoneSpeedFor(tabId);
    const data = speed != null ? { ...config, speed } : config;
    await browser.tabs.sendMessage(tabId, { type: "scroll:start", data });
  }

  async function toggleScroll(tabId: number, config: ScrollConfig) {
    if (await isTabScrolling(tabId)) {
      await browser.tabs.sendMessage(tabId, { type: "scroll:stop" });
    } else {
      await startScroll(tabId, config);
    }
  }

  async function nudgeSpeed(tabId: number, config: ScrollConfig, delta: number) {
    const speed = Math.max(1, Math.min(100, config.speed + delta));
    await defaultConfig.setValue({ ...config, speed });
    await browser.tabs.sendMessage(tabId, { type: "scroll:updateConfig", data: { speed } });
  }

  if (hasContextMenus) {
    browser.runtime.onInstalled.addListener(() => {
      const items = [
        { id: "toggle-scroll", title: "Toggle Auto-Scroll" },
        { id: "speed-slow", title: "Speed: Slow (15)" },
        { id: "speed-medium", title: "Speed: Medium (40)" },
        { id: "speed-fast", title: "Speed: Fast (75)" },
      ];
      for (const item of items) {
        browser.contextMenus.create({ ...item, contexts: ["page"] });
      }
    });

    browser.contextMenus.onClicked.addListener(async (info, tab) => {
      if (!tab?.id) return;
      const config = await defaultConfig.getValue();

      if (info.menuItemId === "toggle-scroll") {
        await toggleScroll(tab.id, config);
        return;
      }

      const speeds: Record<string, number> = {
        "speed-slow": 15,
        "speed-medium": 40,
        "speed-fast": 75,
      };
      const speed = speeds[String(info.menuItemId)];
      if (speed == null) return;
      await defaultConfig.setValue({ ...config, speed });
      await browser.tabs.sendMessage(tab.id, { type: "scroll:updateConfig", data: { speed } });
    });
  }

  if (hasCommands) {
    browser.commands.onCommand.addListener(async (command) => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      const config = await defaultConfig.getValue();

      switch (command) {
        case "toggle-scroll":
          await toggleScroll(tab.id, config);
          break;
        case "speed-up":
          await nudgeSpeed(tab.id, config, 5);
          break;
        case "speed-down":
          await nudgeSpeed(tab.id, config, -5);
          break;
      }
    });
  }

  async function getActiveTabId(): Promise<number | null> {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  }

  browser.runtime.onMessage.addListener((message, sender) => {
    const tabId = sender.tab?.id;

    if (tabId == null) {
      if (
        message.type === "scroll:start" ||
        message.type === "scroll:stop" ||
        message.type === "scroll:updateConfig"
      ) {
        getActiveTabId().then((id) => {
          if (!id) return;
          if (message.type === "scroll:start") {
            startScroll(id, message.data as Partial<ScrollConfig>).catch(() => {});
          } else {
            browser.tabs.sendMessage(id, message).catch(() => {});
          }
        });
      }
      return;
    }

    switch (message.type) {
      case "scroll:start":
        startScroll(tabId, message.data as Partial<ScrollConfig>).catch(() => {});
        break;
      case "scroll:stop":
      case "scroll:updateConfig":
        browser.tabs.sendMessage(tabId, message).catch(() => {});
        break;

      case "scroll:stateChanged": {
        updateBadge(tabId, message.data as ScrollState);
        break;
      }
      case "scroll:finished":
        advanceOrClear(tabId);
        break;
      case "scroll:interactionPause":
        setBadge(tabId, "||", "#f59e0b");
        break;
      case "content:detected":
        recordDetection(
          tabId,
          message.data as {
            type: ContentType;
            confidence: number;
            url: string;
            nextChapterUrl?: string;
          },
        );
        break;
      case "resume:save": {
        const pos = message.data as ResumePosition;
        resumePositions
          .getValue()
          .then((all) => {
            all[pos.url] = pos;
            const entries = Object.entries(all);
            if (entries.length > 50) {
              entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
              all = Object.fromEntries(entries.slice(0, 50));
            }
            return resumePositions.setValue(all);
          })
          .catch((e) => console.error("[autoscroll] resume save failed", e));
        break;
      }
      case "resume:get": {
        const url = message.data as string;
        resumePositions.getValue().then((all) => {
          const pos = all[url];
          if (pos && Date.now() - pos.timestamp < RESUME_POSITION_MAX_AGE_MS) {
            browser.tabs.sendMessage(tabId, { type: "resume:restore", data: pos }).catch(() => {});
          }
        });
        break;
      }
    }
  });

  async function advanceOrClear(tabId: number) {
    await setBadge(tabId, "");

    const next = await tabNextChapter.getValue();
    const nextUrl = next[tabId];
    if (!nextUrl) return;

    const config = await defaultConfig.getValue();
    if (!config.autoAdvanceEnabled) return;

    delete next[tabId];
    await tabNextChapter.setValue(next);

    const pending = await tabAutoStartPending.getValue();
    await tabAutoStartPending.setValue([...new Set([...pending, tabId])]);

    await setBadge(tabId, ">>", "#6366f1");
    await browser.tabs.update(tabId, { url: nextUrl });
  }

  async function recordDetection(
    tabId: number,
    detected: { type: ContentType; confidence: number; url: string; nextChapterUrl?: string },
  ) {
    const types = await tabContentTypes.getValue();
    types[tabId] = detected.type;
    await tabContentTypes.setValue(types);

    if (detected.nextChapterUrl && detected.url) {
      try {
        const next = new URL(detected.nextChapterUrl, detected.url);
        const current = new URL(detected.url);
        if (
          (next.protocol === "http:" || next.protocol === "https:") &&
          next.origin === current.origin
        ) {
          const all = await tabNextChapter.getValue();
          all[tabId] = next.href;
          await tabNextChapter.setValue(all);
        }
      } catch {}
    }

    const zones = await speedZones.getValue();
    const zoneSpeed = zones[detected.type];
    if (zoneSpeed != null) {
      browser.tabs
        .sendMessage(tabId, { type: "scroll:updateConfig", data: { speed: zoneSpeed } })
        .catch(() => {});
    }

    if (detected.url) {
      const list = await profiles.getValue();
      const match = matchProfile(detected.url, list);
      if (match && Object.keys(match.config).length > 0) {
        browser.tabs
          .sendMessage(tabId, { type: "scroll:updateConfig", data: match.config })
          .catch(() => {});
      }
    }
  }

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status !== "complete") return;

    const pending = await tabAutoStartPending.getValue();
    if (!pending.includes(tabId)) return;
    await tabAutoStartPending.setValue(pending.filter((id) => id !== tabId));

    const config = await defaultConfig.getValue();
    await startScroll(tabId, config).catch(() => {});
  });

  browser.tabs.onRemoved.addListener(async (tabId) => {
    const [types, next, pending] = await Promise.all([
      tabContentTypes.getValue(),
      tabNextChapter.getValue(),
      tabAutoStartPending.getValue(),
    ]);
    delete types[tabId];
    delete next[tabId];
    await Promise.all([
      tabContentTypes.setValue(types),
      tabNextChapter.setValue(next),
      tabAutoStartPending.setValue(pending.filter((id) => id !== tabId)),
    ]);
  });
});

function updateBadge(tabId: number, state: ScrollState) {
  if (state.isScrolling) {
    setBadge(tabId, "ON", "#10b981");
  } else {
    setBadge(tabId, "");
  }
}
