import { ScrollEngine } from "@/utils/scroll-engine";
import { defaultConfig } from "@/utils/storage";
import type { ScrollConfig, ResumePosition } from "@/types";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  async main(ctx) {
    const config = await defaultConfig.getValue();
    const engine = new ScrollEngine(config);
    let focusOverlay: FocusOverlay | null = null;
    let wasScrolling = false;

    function savePosition() {
      const el = document.scrollingElement ?? document.documentElement;
      const pos: ResumePosition = {
        url: location.href,
        scrollTop: el.scrollTop,
        scrollLeft: el.scrollLeft,
        timestamp: Date.now(),
      };
      browser.runtime.sendMessage({ type: "resume:save", data: pos }).catch(() => {});
    }

    function updateFocusMode(enabled: boolean) {
      if (enabled && engine.getState().isScrolling) {
        if (!focusOverlay) focusOverlay = new FocusOverlay();
        focusOverlay.show();
      } else {
        focusOverlay?.hide();
      }
    }

    engine.setCallbacks({
      onStateChange: (state) => {
        browser.runtime.sendMessage({ type: "scroll:stateChanged", data: state }).catch(() => {});
        if (wasScrolling && !state.isScrolling) {
          savePosition();
          updateFocusMode(false);
        }
        if (!wasScrolling && state.isScrolling) {
          updateFocusMode(engine.getConfig().focusModeEnabled);
        }
        wasScrolling = state.isScrolling;
      },
      onFinished: () => {
        savePosition();
        updateFocusMode(false);
        browser.runtime.sendMessage({ type: "scroll:finished" }).catch(() => {});
      },
      onInteractionPause: () => {
        browser.runtime.sendMessage({ type: "scroll:interactionPause" }).catch(() => {});
      },
    });

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const { type, data } = message;

      switch (type) {
        case "scroll:start":
          engine.updateConfig(data as ScrollConfig);
          engine.start();
          break;
        case "scroll:stop":
          engine.stop();
          break;
        case "scroll:updateConfig": {
          const partial = data as Partial<ScrollConfig>;
          engine.updateConfig(partial);
          if ("focusModeEnabled" in partial) {
            updateFocusMode(partial.focusModeEnabled!);
          }
          break;
        }
        case "scroll:getState":
          sendResponse(engine.getState());
          return;
        case "resume:restore": {
          const pos = data as ResumePosition;
          window.scrollTo(pos.scrollLeft, pos.scrollTop);
          break;
        }
      }
    });

    browser.runtime.sendMessage({
      type: "resume:get",
      data: location.href,
    }).catch(() => {});

    window.addEventListener("beforeunload", () => {
      if (engine.getState().isScrolling) savePosition();
    });

    ctx.onInvalidated(() => {
      engine.destroy();
      focusOverlay?.hide();
    });
  },
});

class FocusOverlay {
  private top: HTMLDivElement;
  private bottom: HTMLDivElement;
  private visible = false;

  constructor() {
    this.top = this.createPane();
    this.bottom = this.createPane();
    this.top.style.top = "0";
    this.bottom.style.bottom = "0";
    this.updateDimensions();
    window.addEventListener("resize", () => this.updateDimensions());
  }

  private createPane(): HTMLDivElement {
    const el = document.createElement("div");
    el.style.cssText = `
      position: fixed;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.6);
      pointer-events: none;
      z-index: 2147483646;
      transition: opacity 0.3s ease;
      opacity: 0;
    `;
    document.documentElement.appendChild(el);
    return el;
  }

  private updateDimensions() {
    const vh = window.innerHeight;
    const stripHeight = Math.round(vh * 0.35);
    const topHeight = Math.round((vh - stripHeight) / 2);
    const bottomHeight = vh - topHeight - stripHeight;
    this.top.style.height = `${topHeight}px`;
    this.bottom.style.height = `${bottomHeight}px`;
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this.updateDimensions();
    requestAnimationFrame(() => {
      this.top.style.opacity = "1";
      this.bottom.style.opacity = "1";
    });
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.top.style.opacity = "0";
    this.bottom.style.opacity = "0";
  }
}
