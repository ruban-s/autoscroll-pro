import {
  defaultConfig,
  speedZones,
  profiles,
  resumePositions,
} from "@/utils/storage";
import { matchProfile } from "@/utils/profiler";
import { RESUME_POSITION_MAX_AGE_MS } from "@/utils/constants";
import type { ScrollState, ResumePosition } from "@/types";

const tabStates = new Map<number, ScrollState>();
const tabContentTypes = new Map<number, string>();
const tabNextChapter = new Map<number, string>();
const tabAutoStartPending = new Set<number>();

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: "toggle-scroll",
      title: "Toggle Auto-Scroll",
      contexts: ["page"],
    });
    browser.contextMenus.create({
      id: "speed-slow",
      title: "Speed: Slow (15)",
      contexts: ["page"],
    });
    browser.contextMenus.create({
      id: "speed-medium",
      title: "Speed: Medium (40)",
      contexts: ["page"],
    });
    browser.contextMenus.create({
      id: "speed-fast",
      title: "Speed: Fast (75)",
      contexts: ["page"],
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;
    const config = await defaultConfig.getValue();

    switch (info.menuItemId) {
      case "toggle-scroll": {
        const state = tabStates.get(tab.id);
        if (state?.isScrolling) {
          await browser.tabs.sendMessage(tab.id, { type: "scroll:stop" });
        } else {
          const startConfig = { ...config };
          const ct = tabContentTypes.get(tab.id);
          if (ct) {
            const zones = await speedZones.getValue();
            const zs = zones[ct as keyof typeof zones];
            if (zs != null) startConfig.speed = zs;
          }
          await browser.tabs.sendMessage(tab.id, { type: "scroll:start", data: startConfig });
        }
        break;
      }
      case "speed-slow":
      case "speed-medium":
      case "speed-fast": {
        const speeds = { "speed-slow": 15, "speed-medium": 40, "speed-fast": 75 };
        const speed = speeds[info.menuItemId as keyof typeof speeds];
        await defaultConfig.setValue({ ...config, speed });
        await browser.tabs.sendMessage(tab.id, { type: "scroll:updateConfig", data: { speed } });
        break;
      }
    }
  });

  browser.commands.onCommand.addListener(async (command) => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const config = await defaultConfig.getValue();

    switch (command) {
      case "toggle-scroll": {
        const state = tabStates.get(tab.id);
        if (state?.isScrolling) {
          await browser.tabs.sendMessage(tab.id, { type: "scroll:stop" });
        } else {
          const startConfig = { ...config };
          const ct = tabContentTypes.get(tab.id);
          if (ct) {
            const zones = await speedZones.getValue();
            const zs = zones[ct as keyof typeof zones];
            if (zs != null) startConfig.speed = zs;
          }
          await browser.tabs.sendMessage(tab.id, { type: "scroll:start", data: startConfig });
        }
        break;
      }
      case "speed-up": {
        const newSpeed = Math.min(100, config.speed + 5);
        await defaultConfig.setValue({ ...config, speed: newSpeed });
        await browser.tabs.sendMessage(tab.id, { type: "scroll:updateConfig", data: { speed: newSpeed } });
        break;
      }
      case "speed-down": {
        const newSpeed = Math.max(1, config.speed - 5);
        await defaultConfig.setValue({ ...config, speed: newSpeed });
        await browser.tabs.sendMessage(tab.id, { type: "scroll:updateConfig", data: { speed: newSpeed } });
        break;
      }
    }
  });

  async function getActiveTabId(): Promise<number | null> {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  }

  async function sendStartWithZone(tabId: number, message: any) {
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
      if (message.type === "scroll:start" || message.type === "scroll:stop" ||
          message.type === "scroll:updateConfig") {
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
        const state = message.data as ScrollState;
        tabStates.set(tabId, state);
        updateBadge(tabId, state);
        break;
      }
      case "scroll:finished": {
        tabStates.delete(tabId);
        browser.action.setBadgeText({ text: "", tabId });
        const nextUrl = tabNextChapter.get(tabId);
        if (nextUrl) {
          defaultConfig.getValue().then((config) => {
            if (config.autoAdvanceEnabled) {
              tabNextChapter.delete(tabId);
              tabAutoStartPending.add(tabId);
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
        const detected = message.data as { type: string; confidence: number; scrollContainer?: string; nextChapterUrl?: string };
        tabContentTypes.set(tabId, detected.type);

        if (detected.nextChapterUrl && sender.tab?.url) {
          try {
            const next = new URL(detected.nextChapterUrl, sender.tab.url);
            const current = new URL(sender.tab.url);
            if ((next.protocol === "http:" || next.protocol === "https:") && next.origin === current.origin) {
              tabNextChapter.set(tabId, next.href);
            }
          } catch {}
        }

        if (detected.scrollContainer) {
          browser.tabs.sendMessage(tabId, {
            type: "scroll:setContainer",
            data: detected.scrollContainer,
          }).catch(() => {});
        }

        speedZones.getValue().then((zones) => {
          const zoneSpeed = zones[detected.type as keyof typeof zones];
          if (zoneSpeed != null) {
            browser.tabs.sendMessage(tabId, { type: "scroll:updateConfig", data: { speed: zoneSpeed } });
          }
        });

        const url = sender.tab?.url;
        if (url) {
          profiles.getValue().then((list) => {
            const match = matchProfile(url, list);
            if (match && Object.keys(match.config).length > 0) {
              browser.tabs.sendMessage(tabId, {
                type: "scroll:updateConfig",
                data: match.config,
              }).catch(() => {});
            }
          });
        }

        if (tabAutoStartPending.has(tabId)) {
          tabAutoStartPending.delete(tabId);
          defaultConfig.getValue().then(async (config) => {
            const startConfig = { ...config };
            const zones = await speedZones.getValue();
            const zoneSpeed = zones[detected.type as keyof typeof zones];
            if (zoneSpeed != null) startConfig.speed = zoneSpeed;
            browser.tabs.sendMessage(tabId, { type: "scroll:start", data: startConfig }).catch(() => {});
          });
        }
        break;
      }
      case "profile:getForSite": {
        const url = message.data as string;
        profiles.getValue().then((list) => {
          const match = matchProfile(url, list);
          sender.tab?.id &&
            browser.tabs.sendMessage(sender.tab.id, {
              type: "scroll:updateConfig",
              data: match?.config ?? {},
            }).catch(() => {});
        });
        break;
      }
      case "resume:save": {
        const pos = message.data as ResumePosition;
        resumePositions.getValue().then((all) => {
          all[pos.url] = pos;
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
              browser.tabs.sendMessage(sender.tab.id, {
                type: "resume:restore",
                data: pos,
              }).catch(() => {});
          }
        });
        break;
      }
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    tabStates.delete(tabId);
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
