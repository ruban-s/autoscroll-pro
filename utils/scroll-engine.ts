import type { ScrollConfig, ScrollState, ContentType } from "@/types";
import { INTERACTION_RESUME_DELAY_MS, END_GRACE_MS } from "./constants";

const SCROLL_EPSILON = 1;

export function isScrollable(el: Element, vertical: boolean): boolean {
  const room = vertical
    ? el.scrollHeight - el.clientHeight
    : el.scrollWidth - el.clientWidth;
  if (room <= SCROLL_EPSILON) return false;

  const root = document.scrollingElement ?? document.documentElement;
  if (el === root || el === document.documentElement || el === document.body) {
    return true;
  }

  const style = getComputedStyle(el);
  const overflow = vertical ? style.overflowY : style.overflowX;
  return overflow === "auto" || overflow === "scroll" || overflow === "overlay";
}

export function pickScrollTarget(
  hint: Element | null,
  vertical: boolean,
): Element {
  const root = document.scrollingElement ?? document.documentElement;

  for (let el: Element | null = hint; el; el = el.parentElement) {
    if (isScrollable(el, vertical)) return el;
  }
  if (isScrollable(root, vertical)) return root;

  const stack = document.elementsFromPoint(
    Math.floor(window.innerWidth / 2),
    Math.floor(window.innerHeight / 2),
  );
  for (const el of stack) {
    if (isScrollable(el, vertical)) return el;
  }

  return root;
}

export class ScrollEngine {
  private rafId: number | null = null;
  private stepTimerId: ReturnType<typeof setInterval> | null = null;
  private lastTimestamp = 0;
  private elapsedMs = 0;
  private scrolling = false;
  private pausedByInteraction = false;
  private interactionTimer: ReturnType<typeof setTimeout> | null = null;
  private boundInteractionHandler: () => void;
  private config: ScrollConfig;
  private hintElement: Element | null = null;
  private target: Element | null = null;
  private subPixel = 0;
  private endSinceMs = 0;
  private lastGrowthMs = 0;
  private lastScrollSize = 0;
  private snapElement: HTMLElement | null = null;
  private snapPrevious = "";
  private lastEmitTime = 0;
  private onStateChange?: (state: ScrollState) => void;
  private onFinished?: () => void;
  private onInteractionPause?: () => void;
  private contentType: ContentType = "general";

  constructor(config: ScrollConfig) {
    this.config = { ...config };
    this.boundInteractionHandler = this.handleInteraction.bind(this);
  }

  setCallbacks(cbs: {
    onStateChange?: (state: ScrollState) => void;
    onFinished?: () => void;
    onInteractionPause?: () => void;
  }) {
    this.onStateChange = cbs.onStateChange;
    this.onFinished = cbs.onFinished;
    this.onInteractionPause = cbs.onInteractionPause;
  }

  setContentType(type: ContentType) {
    this.contentType = type;
  }

  setScrollElement(el: Element | null) {
    this.hintElement = el;
    this.target = null;
  }

  start() {
    if (this.scrolling) return;
    this.scrolling = true;
    this.pausedByInteraction = false;

    if (this.config.autoPauseOnInteraction) {
      this.attachInteractionListeners();
    }

    this.beginAnimation();
    this.emitState();
  }

  stop() {
    this.scrolling = false;
    this.cancelAnimation();
    this.detachInteractionListeners();
    this.elapsedMs = 0;
    this.emitState();
  }

  pause() {
    if (!this.scrolling) return;
    this.scrolling = false;
    this.cancelAnimation();
    this.emitState();
  }

  resume() {
    if (this.scrolling) return;
    this.scrolling = true;
    this.pausedByInteraction = false;

    this.beginAnimation();
    this.emitState();
  }

  toggle() {
    if (this.scrolling) {
      this.pause();
    } else {
      this.resume();
    }
  }

  updateConfig(partial: Partial<ScrollConfig>) {
    const prevMode = this.config.mode;
    const prevDirection = this.config.direction;
    Object.assign(this.config, partial);

    if (prevDirection !== this.config.direction) this.target = null;

    if (
      this.scrolling &&
      (prevMode !== this.config.mode || prevDirection !== this.config.direction)
    ) {
      this.cancelAnimation();
      this.beginAnimation();
    }

    this.emitState();
  }

  getState(): ScrollState {
    return {
      isScrolling: this.scrolling,
      progress: this.getProgress(),
      contentType: this.contentType,
      currentSpeed: this.config.speed,
      elapsedMs: this.elapsedMs,
      isPausedByInteraction: this.pausedByInteraction,
    };
  }

  getConfig(): ScrollConfig {
    return { ...this.config };
  }

  destroy() {
    this.stop();
    this.detachInteractionListeners();
  }

  private tick = (timestamp: number) => {
    if (!this.scrolling) return;

    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
      this.rafId = requestAnimationFrame(this.tick);
      return;
    }

    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.elapsedMs += delta;

    if (this.config.timerEnabled && this.elapsedMs >= this.config.timerDurationMs) {
      this.stop();
      this.onFinished?.();
      return;
    }

    const pxPerFrame = this.speedToPx(this.config.speed);
    const scrollAmount = pxPerFrame * (delta / 16.67);
    this.scrollBy(scrollAmount);

    if (timestamp - this.lastEmitTime > 500) {
      this.lastEmitTime = timestamp;
      this.emitState();
    }

    if (this.shouldStop()) {
      this.stop();
      this.onFinished?.();
      return;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  private beginAnimation() {
    this.lastTimestamp = 0;
    this.subPixel = 0;
    this.endSinceMs = 0;
    this.lastScrollSize = 0;
    this.target = null;
    this.disableSnap();

    if (this.config.mode === "smooth") {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.startStepMode();
    }
  }

  private startStepMode() {
    this.stepTimerId = setInterval(() => {
      if (!this.scrolling) return;

      this.elapsedMs += this.config.stepInterval;

      if (this.config.timerEnabled && this.elapsedMs >= this.config.timerDurationMs) {
        this.stop();
        this.onFinished?.();
        return;
      }

      this.scrollBy(this.config.stepSize);

      if (this.shouldStop()) {
        this.stop();
        this.onFinished?.();
      }
    }, this.config.stepInterval);
  }

  private scrollBy(amount: number) {
    const el = this.getScrollTarget();
    const backwards =
      this.config.direction === "up" || this.config.direction === "left";

    const total = (backwards ? -amount : amount) + this.subPixel;
    const whole = Math.trunc(total);
    this.subPixel = total - whole;
    if (whole === 0) return;

    // "instant" overrides a page's CSS scroll-behavior: smooth, which would
    // otherwise animate — and fight — every per-frame step.
    el.scrollTo(
      this.isVertical()
        ? { top: el.scrollTop + whole, behavior: "instant" }
        : { left: el.scrollLeft + whole, behavior: "instant" },
    );
  }

  private isVertical(): boolean {
    return this.config.direction === "down" || this.config.direction === "up";
  }

  private getScrollTarget(): Element {
    const vertical = this.isVertical();
    if (this.target?.isConnected && isScrollable(this.target, vertical)) {
      return this.target;
    }
    this.target = pickScrollTarget(this.hintElement, vertical);
    return this.target;
  }

  private disableSnap() {
    const el = this.getScrollTarget();
    if (!(el instanceof HTMLElement)) return;
    if (getComputedStyle(el).scrollSnapType === "none") return;
    this.snapElement = el;
    this.snapPrevious = el.style.scrollSnapType;
    el.style.scrollSnapType = "none";
  }

  private restoreSnap() {
    if (!this.snapElement) return;
    this.snapElement.style.scrollSnapType = this.snapPrevious;
    this.snapElement = null;
    this.snapPrevious = "";
  }

  private speedToPx(speed: number): number {
    return 0.5 + Math.pow(speed / 100, 2) * 29.5;
  }

  private getProgress(): number {
    const el = this.getScrollTarget();
    const isVertical = this.isVertical();

    if (isVertical) {
      const max = el.scrollHeight - el.clientHeight;
      return max > 0 ? (el.scrollTop / max) * 100 : 0;
    }

    const max = el.scrollWidth - el.clientWidth;
    return max > 0 ? (el.scrollLeft / max) * 100 : 0;
  }

  private shouldStop(): boolean {
    const el = this.getScrollTarget();
    const size = this.isVertical() ? el.scrollHeight : el.scrollWidth;
    const now = performance.now();

    if (size !== this.lastScrollSize) {
      this.lastScrollSize = size;
      this.lastGrowthMs = now;
    }

    if (!this.isAtEnd()) {
      this.endSinceMs = 0;
      return false;
    }

    if (this.endSinceMs === 0) this.endSinceMs = now;

    return (
      now - this.endSinceMs >= END_GRACE_MS &&
      now - this.lastGrowthMs >= END_GRACE_MS
    );
  }

  private isAtEnd(): boolean {
    const el = this.getScrollTarget();
    const tolerance = 2;

    switch (this.config.direction) {
      case "down":
        return el.scrollTop + el.clientHeight >= el.scrollHeight - tolerance;
      case "up":
        return el.scrollTop <= tolerance;
      case "right":
        return el.scrollLeft + el.clientWidth >= el.scrollWidth - tolerance;
      case "left":
        return el.scrollLeft <= tolerance;
    }
  }

  private cancelAnimation() {
    this.restoreSnap();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.stepTimerId !== null) {
      clearInterval(this.stepTimerId);
      this.stepTimerId = null;
    }
  }

  private handleInteraction() {
    if (!this.scrolling || !this.config.autoPauseOnInteraction) return;

    this.pausedByInteraction = true;
    this.cancelAnimation();
    this.scrolling = false;
    this.emitState();
    this.onInteractionPause?.();

    if (this.interactionTimer) clearTimeout(this.interactionTimer);
    this.interactionTimer = setTimeout(() => {
      if (this.pausedByInteraction) {
        this.pausedByInteraction = false;
        this.resume();
      }
    }, INTERACTION_RESUME_DELAY_MS);
  }

  private attachInteractionListeners() {
    const events = ["wheel", "mousedown", "touchstart"] as const;
    for (const evt of events) {
      window.addEventListener(evt, this.boundInteractionHandler, {
        passive: true,
      });
    }
  }

  private detachInteractionListeners() {
    const events = ["wheel", "mousedown", "touchstart"] as const;
    for (const evt of events) {
      window.removeEventListener(evt, this.boundInteractionHandler);
    }
    if (this.interactionTimer) {
      clearTimeout(this.interactionTimer);
      this.interactionTimer = null;
    }
  }

  private emitState() {
    this.onStateChange?.(this.getState());
  }
}
