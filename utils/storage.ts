import { storage } from "wxt/utils/storage";
import type { ContentType, ResumePosition, ScrollConfig, ScrollProfile } from "@/types";
import { DEFAULT_CONFIG, DEFAULT_SPEED_ZONES } from "./constants";

export const defaultConfig = storage.defineItem<ScrollConfig>("sync:defaultConfig", {
  fallback: DEFAULT_CONFIG,
});

export const theme = storage.defineItem<"light" | "dark" | "system">("sync:theme", {
  fallback: "system",
});

export const speedZones = storage.defineItem<Record<ContentType, number>>("sync:speedZones", {
  fallback: DEFAULT_SPEED_ZONES,
});

export const profiles = storage.defineItem<ScrollProfile[]>("sync:profiles", {
  fallback: [],
});

// Local, not sync: 50 full hrefs overflow storage.sync's 8KB per-item quota.
export const resumePositions = storage.defineItem<Record<string, ResumePosition>>(
  "local:resumePositions",
  {
    fallback: {},
  },
);

export const siteSpeeds = storage.defineItem<Record<string, number>>("local:siteSpeeds", {
  fallback: {},
});

export const siteContainers = storage.defineItem<Record<string, string>>("local:siteContainers", {
  fallback: {},
});

export const widgetPosition = storage.defineItem<{ x: number; y: number }>("local:widgetPosition", {
  fallback: { x: 16, y: 100 },
});
