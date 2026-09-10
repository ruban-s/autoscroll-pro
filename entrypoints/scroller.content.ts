import type { ResumePosition, ScrollConfig } from "@/types";
import { detectContentType } from "@/utils/content-detector";
import { ContainerPicker } from "@/utils/picker";
import { ScrollEngine } from "@/utils/scroll-engine";
import { defaultConfig, siteContainers, siteSpeeds } from "@/utils/storage";
import { ScrollWidget } from "@/utils/widget";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  async main(ctx) {
    const config = await defaultConfig.getValue();
    const site = location.hostname;

    const [speeds, containers] = await Promise.all([
      siteSpeeds.getValue().catch(() => ({}) as Record<string, number>),
      siteContainers.getValue().catch(() => ({}) as Record<string, string>),
    ]);
    if (speeds[site] != null) config.speed = speeds[site];

    const engine = new ScrollEngine(config);
    let focusOverlay: FocusOverlay | null = null;
    let widget: ScrollWidget | null = null;
    let picker: ContainerPicker | null = null;
    let wasScrolling = false;
    let pausedBySpace = false;

    const detection = detectContentType(document, location.href);
    const detected = detection.type !== "general" && detection.confidence >= 0.3;

    // A container the user picked by hand always beats a guessed one.
    const savedContainer = containers[site];
    if (savedContainer) {
      engine.setScrollElement(document.querySelector(savedContainer));
    }

    if (detected) {
      engine.setContentType(detection.type);
      if (!savedContainer && detection.metadata.scrollContainer) {
        engine.setScrollElement(document.querySelector(detection.metadata.scrollContainer));
      }
      browser.runtime
        .sendMessage({
          type: "content:detected",
          data: {
            type: detection.type,
            confidence: detection.confidence,
            url: location.href,
            nextChapterUrl: detection.metadata.nextChapterUrl,
          },
        })
        .catch(() => {});
    }

    function rememberSpeed(speed: number) {
      siteSpeeds
        .getValue()
        .then((all) => siteSpeeds.setValue({ ...all, [site]: speed }))
        .catch(() => {});
    }

    function updateWidget(enabled: boolean) {
      if (enabled && !widget) {
        widget = new ScrollWidget({
          onToggle: () => (engine.getState().isScrolling ? engine.stop() : engine.start()),
          onSpeedChange: (delta) => {
            const speed = Math.max(1, Math.min(100, engine.getConfig().speed + delta));
            engine.updateConfig({ speed });
            rememberSpeed(speed);
          },
        });
        widget.update(engine.getState());
      } else if (!enabled && widget) {
        widget.destroy();
        widget = null;
      }
    }

    function startPicker() {
      picker?.destroy();
      picker = new ContainerPicker((el, selector) => {
        engine.setScrollElement(el);
        siteContainers
          .getValue()
          .then((all) => siteContainers.setValue({ ...all, [site]: selector }))
          .catch(() => {});
        picker = null;
      });
    }

    updateWidget(config.widgetEnabled);

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
        widget?.update(state);
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
          pausedBySpace = false;
          engine.updateConfig(data as ScrollConfig);
          engine.start();
          break;
        case "scroll:stop":
          pausedBySpace = false;
          engine.stop();
          break;
        case "scroll:updateConfig": {
          // `remember` marks a deliberate user change; the background also uses
          // this message to push content-type speed zones, which must not stick.
          const partial = data as Partial<ScrollConfig> & { remember?: boolean };
          engine.updateConfig(partial);
          if (partial.focusModeEnabled !== undefined) {
            updateFocusMode(partial.focusModeEnabled);
          }
          if (partial.widgetEnabled !== undefined) {
            updateWidget(partial.widgetEnabled);
          }
          if (partial.speed !== undefined && partial.remember) {
            rememberSpeed(partial.speed);
          }
          break;
        }
        case "picker:start":
          startPicker();
          break;
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

    browser.runtime
      .sendMessage({
        type: "resume:get",
        data: location.href,
      })
      .catch(() => {});

    // Space is the reader's pause key, but only claim it while we are actually
    // scrolling or holding a pause we took, and never while the user is typing.
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.code !== "Space" || e.altKey || e.ctrlKey || e.metaKey) return;
        if (!engine.getState().isScrolling && !pausedBySpace) return;

        const target = e.target as HTMLElement | null;
        if (target?.isContentEditable) return;
        if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

        e.preventDefault();
        if (pausedBySpace) {
          pausedBySpace = false;
          engine.resume();
        } else {
          pausedBySpace = true;
          engine.pause();
        }
      },
      true,
    );

    window.addEventListener("pagehide", () => {
      if (engine.getState().isScrolling) savePosition();
      focusOverlay?.hide();
    });

    ctx.onInvalidated(() => {
      engine.destroy();
      focusOverlay?.hide();
      widget?.destroy();
      picker?.destroy();
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
