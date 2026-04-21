export type ScrollDirection = "down" | "up" | "left" | "right";
export type ScrollMode = "smooth" | "step";
export type ContentType =
  | "general"
  | "pdf"
  | "manga"
  | "blog"
  | "infinite-scroll";

export interface ScrollConfig {
  speed: number;
  direction: ScrollDirection;
  mode: ScrollMode;
  stepSize: number;
  stepInterval: number;
  autoPauseOnInteraction: boolean;
  focusModeEnabled: boolean;
  timerEnabled: boolean;
  timerDurationMs: number;
}

export interface ScrollState {
  isScrolling: boolean;
  progress: number;
  contentType: ContentType;
  currentSpeed: number;
  elapsedMs: number;
  isPausedByInteraction: boolean;
}
