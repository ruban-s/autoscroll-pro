import type { ResumePosition, ScrollConfig, ScrollState } from "@/types";
import { RESUME_POSITION_MAX_AGE_MS } from "@/utils/constants";
import { matchProfile } from "@/utils/profiler";
import { defaultConfig, profiles, resumePositions, speedZones } from "@/utils/storage";

const tabContentTypes = new Map<number, string>();
const tabNextChapter = new Map<number, string>();
const tabAutoStartPending = new Set<number>();

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

export default defineBackground(() => {
  // Firefox for Android implements neither menus nor commands; touching either
  // at top level throws and takes the whole background script down with it.
  const hasContextMenus = typeof browser.contextMenus !== "undefined";
  const hasCommands = typeof browser.commands !== "undefined";

  async function startScroll(tabId: number, config: ScrollConfig) {
    const startConfig = { ...config };
    const contentType = tabContentTypes.get(tabId);
    if (contentType) {
      const zones = await speedZones.getValue();
      const zoneSpeed = zones[contentType as keyof typeof zones];
      if (zoneSpeed != null) startConfig.speed = zoneSpeed;
    }
    await browser.tabs.sendMessage(tabId, { type: "scroll:start", data: startConfig });
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

  async function sendStartWithZone(
    tabId: number,
    message: { type: string; data?: Partial<ScrollConfig> },
  ) {
    const contentType = tabContentTypes.get(tabId);
    if (contentType) {
      const zones = await speedZones.getValue();
      const zoneSpeed = zones[contentType as keyof typeof zones];
      if (zoneSpeed != null && message.data) {
        message.data.speed = zoneSpeed;
      }
    }
    browser.tabs.sendMessage(tabId, message).catch(() => {});
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
            sendStartWithZone(id, message);
          } else {
            browser.tabs.sendMessage(id, message).catch(() => {});
          }
        });
      }
      return;
    }

    switch (message.type) {
      case "scroll:start":
        sendStartWithZone(tabId, message);
        break;
      case "scroll:stop":
      case "scroll:updateConfig":
        browser.tabs.sendMessage(tabId, message).catch(() => {});
        break;

      case "scroll:stateChanged": {
        updateBadge(tabId, message.data as ScrollState);
        break;
      }
      case "scroll:finished": {
        browser.action.setBadgeText({ text: "", tabId });
        const nextUrl = tabNextChapter.get(tabId);
        if (nextUrl) {
          defaultConfig.getValue().then((config) => {
            if (config.autoAdvanceEnabled) {
              tabNextChapter.delete(tabId);
              tabAutoStartPending.add(tabId);
              browser.action.setBadgeText({ text: ">>", tabId });
              browser.action.setBadgeBackgroundColor({ color: "#6366f1", tabId });
              browser.tabs.update(tabId, { url: nextUrl });
            }
          });
        }
        break;
      }
      case "scroll:interactionPause":
        browser.action.setBadgeText({ text: "||", tabId });
        browser.action.setBadgeBackgroundColor({ color: "#f59e0b", tabId });
        break;
      case "content:detected": {
        const detected = message.data as {
          type: string;
          confidence: number;
          url: string;
          nextChapterUrl?: string;
        };
        tabContentTypes.set(tabId, detected.type);

        if (detected.nextChapterUrl && detected.url) {
          try {
            const next = new URL(detected.nextChapterUrl, detected.url);
            const current = new URL(detected.url);
            if (
              (next.protocol === "http:" || next.protocol === "https:") &&
              next.origin === current.origin
            ) {
              tabNextChapter.set(tabId, next.href);
            }
          } catch {}
        }

        speedZones.getValue().then((zones) => {
          const zoneSpeed = zones[detected.type as keyof typeof zones];
          if (zoneSpeed != null) {
            browser.tabs.sendMessage(tabId, {
              type: "scroll:updateConfig",
              data: { speed: zoneSpeed },
            });
          }
        });

        const url = detected.url;
        if (url) {
          profiles.getValue().then((list) => {
            const match = matchProfile(url, list);
            if (match && Object.keys(match.config).length > 0) {
              browser.tabs
                .sendMessage(tabId, {
                  type: "scroll:updateConfig",
                  data: match.config,
                })
                .catch(() => {});
            }
          });
        }

        break;
      }
      case "profile:getForSite": {
        const url = message.data as string;
        profiles.getValue().then((list) => {
          const match = matchProfile(url, list);
          sender.tab?.id &&
            browser.tabs
              .sendMessage(sender.tab.id, {
                type: "scroll:updateConfig",
                data: match?.config ?? {},
              })
              .catch(() => {});
        });
        break;
      }
      case "profile:save": {
        const profile = message.data as import("@/types").ScrollProfile;
        profiles.getValue().then((list) => {
          const idx = list.findIndex((p) => p.id === profile.id);
          const updated =
            idx >= 0
              ? list.map((p) => (p.id === profile.id ? { ...profile, updatedAt: Date.now() } : p))
              : [...list, { ...profile, updatedAt: Date.now() }];
          profiles.setValue(updated);
        });
        break;
      }
      case "resume:save": {
        const pos = message.data as ResumePosition;
        resumePositions.getValue().then((all) => {
          all[pos.url] = pos;
          const entries = Object.entries(all);
          if (entries.length > 50) {
            entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
            all = Object.fromEntries(entries.slice(0, 50));
          }
          resumePositions.setValue(all);
        });
        break;
      }
      case "resume:get": {
        const url = message.data as string;
        resumePositions.getValue().then((all) => {
          const pos = all[url];
          if (pos && Date.now() - pos.timestamp < RESUME_POSITION_MAX_AGE_MS) {
            sender.tab?.id &&
              browser.tabs
                .sendMessage(sender.tab.id, {
                  type: "resume:restore",
                  data: pos,
                })
                .catch(() => {});
          }
        });
        break;
      }
    }
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete" && tabAutoStartPending.has(tabId)) {
      tabAutoStartPending.delete(tabId);
      defaultConfig.getValue().then(async (config) => {
        const startConfig = { ...config };
        const ct = tabContentTypes.get(tabId);
        if (ct) {
          const zones = await speedZones.getValue();
          const zoneSpeed = zones[ct as keyof typeof zones];
          if (zoneSpeed != null) startConfig.speed = zoneSpeed;
        }
        browser.tabs
          .sendMessage(tabId, { type: "scroll:start", data: startConfig })
          .catch(() => {});
      });
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    tabContentTypes.delete(tabId);
    tabNextChapter.delete(tabId);
    tabAutoStartPending.delete(tabId);
  });
});

function updateBadge(tabId: number, state: ScrollState) {
  if (state.isScrolling) {
    browser.action.setBadgeText({ text: "ON", tabId });
    browser.action.setBadgeBackgroundColor({ color: "#10b981", tabId });
  } else {
    browser.action.setBadgeText({ text: "", tabId });
  }
}
