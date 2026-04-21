import type { ScrollConfig, ContentType } from "@/types";

export const DEFAULT_CONFIG: ScrollConfig = {
  speed: 30,
  direction: "down",
  mode: "smooth",
  stepSize: 300,
  stepInterval: 1500,
  autoPauseOnInteraction: true,
  focusModeEnabled: false,
  timerEnabled: false,
  timerDurationMs: 300_000,
};

export const DEFAULT_SPEED_ZONES: Record<ContentType, number> = {
  general: 30,
  pdf: 20,
  manga: 50,
  blog: 25,
  "infinite-scroll": 35,
};

export const SPEED_MIN = 1;
export const SPEED_MAX = 100;
export const INTERACTION_RESUME_DELAY_MS = 2000;
export const RESUME_POSITION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
