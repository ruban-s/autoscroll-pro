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
          await browser.tabs.sendMessage(tab.id, { type: "scroll:start", data: config });
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
          await browser.tabs.sendMessage(tab.id, { type: "scroll:start", data: config });
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
      case "toggle-widget": {
        await browser.tabs.sendMessage(tab.id, { type: "widget:toggle" });
        break;
      }
    }
  });

  browser.runtime.onMessage.addListener((message, sender) => {
    const tabId = sender.tab?.id;
    if (tabId == null) return;

    switch (message.type) {
      case "scroll:start":
      case "scroll:stop":
      case "scroll:updateConfig":
        browser.tabs.sendMessage(tabId, message).catch(() => {});
        break;

      case "scroll:stateChanged": {
        const state = message.data as ScrollState;
        tabStates.set(tabId, state);
        updateBadge(tabId, state);
        browser.tabs.sendMessage(tabId, message).catch(() => {});
        break;
      }
      case "scroll:finished":
        tabStates.delete(tabId);
        browser.action.setBadgeText({ text: "", tabId });
        break;
      case "scroll:interactionPause":
        browser.action.setBadgeText({ text: "||", tabId });
        browser.action.setBadgeBackgroundColor({ color: "#f59e0b", tabId });
        break;
      case "content:detected": {
        const detected = message.data as { type: string; confidence: number };
        speedZones.getValue().then((zones) => {
          const zoneSpeed = zones[detected.type as keyof typeof zones];
          if (zoneSpeed != null) {
            browser.tabs.sendMessage(tabId, { type: "scroll:updateConfig", data: { speed: zoneSpeed } });
          }
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
    }
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
