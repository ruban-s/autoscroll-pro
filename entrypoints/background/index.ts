import { onMessage } from "@/utils/messaging";
import {
  defaultConfig,
  speedZones,
  profiles,
  resumePositions,
} from "@/utils/storage";
import { matchProfile } from "@/utils/profiler";
import { RESUME_POSITION_MAX_AGE_MS } from "@/utils/constants";
import type { ScrollState } from "@/types";
import type { ResumePosition } from "@/types";

const tabStates = new Map<number, ScrollState>();

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
      parentId: undefined,
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
          await browser.tabs.sendMessage(tab.id, {
            type: "scroll:stop",
            data: undefined,
          });
        } else {
          await browser.tabs.sendMessage(tab.id, {
            type: "scroll:start",
            data: config,
          });
        }
        break;
      }
      case "speed-slow":
      case "speed-medium":
      case "speed-fast": {
        const speeds = { "speed-slow": 15, "speed-medium": 40, "speed-fast": 75 };
        const speed = speeds[info.menuItemId as keyof typeof speeds];
        await defaultConfig.setValue({ ...config, speed });
        await browser.tabs.sendMessage(tab.id, {
          type: "scroll:updateConfig",
          data: { speed },
        });
        break;
      }
    }
  });

  browser.commands.onCommand.addListener(async (command) => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    const config = await defaultConfig.getValue();

    switch (command) {
      case "toggle-scroll": {
        const state = tabStates.get(tab.id);
        if (state?.isScrolling) {
          await browser.tabs.sendMessage(tab.id, {
            type: "scroll:stop",
            data: undefined,
          });
        } else {
          await browser.tabs.sendMessage(tab.id, {
            type: "scroll:start",
            data: config,
          });
        }
        break;
      }
      case "speed-up": {
        const newSpeed = Math.min(100, config.speed + 5);
        await defaultConfig.setValue({ ...config, speed: newSpeed });
        await browser.tabs.sendMessage(tab.id, {
          type: "scroll:updateConfig",
          data: { speed: newSpeed },
        });
        break;
      }
      case "speed-down": {
        const newSpeed = Math.max(1, config.speed - 5);
        await defaultConfig.setValue({ ...config, speed: newSpeed });
        await browser.tabs.sendMessage(tab.id, {
          type: "scroll:updateConfig",
          data: { speed: newSpeed },
        });
        break;
      }
      case "toggle-widget": {
        const [activeTab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (activeTab?.id) {
          await browser.tabs.sendMessage(activeTab.id, {
            type: "widget:toggle",
            data: undefined,
          });
        }
        break;
      }
    }
  });

  onMessage("scroll:stateChanged", ({ data, sender }) => {
    const tabId = sender.tab?.id;
    if (tabId != null) {
      tabStates.set(tabId, data as ScrollState);
      updateBadge(tabId, data as ScrollState);
    }
  });

  onMessage("scroll:finished", ({ sender }) => {
    const tabId = sender.tab?.id;
    if (tabId != null) {
      tabStates.delete(tabId);
      browser.action.setBadgeText({ text: "", tabId });
    }
  });

  onMessage("scroll:interactionPause", ({ sender }) => {
    const tabId = sender.tab?.id;
    if (tabId != null) {
      browser.action.setBadgeText({ text: "||", tabId });
      browser.action.setBadgeBackgroundColor({ color: "#f59e0b", tabId });
    }
  });

  onMessage("content:detected", async ({ data, sender }) => {
    const tabId = sender.tab?.id;
    if (tabId == null) return;

    const zones = await speedZones.getValue();
    const detected = data as { type: string; confidence: number };
    const zoneSpeed = zones[detected.type as keyof typeof zones];
    if (zoneSpeed != null) {
      await browser.tabs.sendMessage(tabId, {
        type: "scroll:updateConfig",
        data: { speed: zoneSpeed },
      });
    }
  });

  onMessage("profile:getForSite", async ({ data }) => {
    const url = data as string;
    const list = await profiles.getValue();
    return matchProfile(url, list);
  });

  onMessage("profile:save", async ({ data }) => {
    const profile = data as any;
    const list = await profiles.getValue();
    const idx = list.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      list[idx] = profile;
    } else {
      list.push(profile);
    }
    await profiles.setValue(list);
  });

  onMessage("resume:save", async ({ data }) => {
    const pos = data as ResumePosition;
    const all = await resumePositions.getValue();
    all[pos.url] = pos;
    await resumePositions.setValue(all);
  });

  onMessage("resume:get", async ({ data }) => {
    const url = data as string;
    const all = await resumePositions.getValue();
    const pos = all[url];
    if (!pos) return null;
    if (Date.now() - pos.timestamp > RESUME_POSITION_MAX_AGE_MS) {
      delete all[url];
      await resumePositions.setValue(all);
      return null;
    }
    return pos;
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    tabStates.delete(tabId);
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
