import { storage } from "wxt/utils/storage";
import type { ScrollConfig, ContentType, ScrollProfile } from "@/types";
import type { ResumePosition } from "@/types";
import { DEFAULT_CONFIG, DEFAULT_SPEED_ZONES } from "./constants";

export const defaultConfig = storage.defineItem<ScrollConfig>(
  "sync:defaultConfig",
  { fallback: DEFAULT_CONFIG },
);

export const theme = storage.defineItem<"light" | "dark" | "system">(
  "sync:theme",
  { fallback: "system" },
);

export const speedZones = storage.defineItem<Record<ContentType, number>>(
  "sync:speedZones",
  { fallback: DEFAULT_SPEED_ZONES },
);

export const profiles = storage.defineItem<ScrollProfile[]>("sync:profiles", {
  fallback: [],
});

export const resumePositions = storage.defineItem<
  Record<string, ResumePosition>
>("sync:resumePositions", {
  fallback: {},
});

export const customShortcuts = storage.defineItem<Record<string, string>>(
  "sync:customShortcuts",
  {
    fallback: {
      toggleScroll: "Alt+S",
      speedUp: "Alt+ArrowUp",
      speedDown: "Alt+ArrowDown",
    },
  },
);
