import type { ScrollConfig, ScrollState, ContentType } from "@/types";
import { INTERACTION_RESUME_DELAY_MS } from "./constants";

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
  private scrollElement: Element | null = null;
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
    this.scrollElement = el;
  }

  start() {
    if (this.scrolling) return;
    this.scrolling = true;
    this.pausedByInteraction = false;
    this.lastTimestamp = 0;

    if (this.config.autoPauseOnInteraction) {
      this.attachInteractionListeners();
    }

    if (this.config.mode === "smooth") {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.startStepMode();
    }

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
    this.lastTimestamp = 0;

    if (this.config.mode === "smooth") {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.startStepMode();
    }

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
    Object.assign(this.config, partial);

    if (this.scrolling && prevMode !== this.config.mode) {
      this.cancelAnimation();
      if (this.config.mode === "smooth") {
        this.lastTimestamp = 0;
        this.rafId = requestAnimationFrame(this.tick);
      } else {
        this.startStepMode();
      }
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

    if (this.isAtEnd()) {
      this.stop();
      this.onFinished?.();
      return;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

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

      if (this.isAtEnd()) {
        this.stop();
        this.onFinished?.();
      }
    }, this.config.stepInterval);
  }

  private scrollBy(amount: number) {
    const el = this.getScrollTarget();
    switch (this.config.direction) {
      case "down":
        el.scrollTop += amount;
        break;
      case "up":
        el.scrollTop -= amount;
        break;
      case "right":
        el.scrollLeft += amount;
        break;
      case "left":
        el.scrollLeft -= amount;
        break;
    }
  }

  private getScrollTarget(): Element {
    return this.scrollElement ?? document.documentElement;
  }

  private speedToPx(speed: number): number {
    return 0.5 + Math.pow(speed / 100, 2) * 29.5;
  }

  private getProgress(): number {
    const el = this.getScrollTarget();
    const isVertical =
      this.config.direction === "down" || this.config.direction === "up";

    if (isVertical) {
      const max = el.scrollHeight - el.clientHeight;
      return max > 0 ? (el.scrollTop / max) * 100 : 0;
    }

    const max = el.scrollWidth - el.clientWidth;
    return max > 0 ? (el.scrollLeft / max) * 100 : 0;
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
