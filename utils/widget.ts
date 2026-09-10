import { widgetPosition } from "./storage";

interface WidgetCallbacks {
  onToggle: () => void;
  onSpeedChange: (delta: number) => void;
}

const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SVG_NS = "http://www.w3.org/2000/svg";

const GLYPH = {
  play: "▶",
  pause: "⏸",
  minus: "−",
  plus: "+",
  up: "▲",
  down: "▼",
};

const STYLE = `
  .card {
    position: fixed;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-radius: 16px;
    background: #1a1a2e;
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .card.collapsed { padding: 8px; gap: 4px; }
  .card.collapsed .expanded { display: none; }
  .dial { position: relative; width: 48px; height: 48px; }
  .dial svg { display: block; }
  .play {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    background: none; border: none; padding: 0;
    font-size: 20px; line-height: 1; cursor: pointer; color: #10b981;
  }
  .play.on { color: #ef4444; }
  .row { display: flex; align-items: center; gap: 6px; }
  .btn {
    min-width: 28px; min-height: 28px;
    padding: 4px 8px; border: none; border-radius: 6px;
    background: rgba(255,255,255,0.1); color: #fff;
    font-size: 14px; line-height: 1; cursor: pointer;
  }
  .btn:hover { background: rgba(255,255,255,0.2); }
  .btn.small { min-width: 0; min-height: 0; padding: 2px 8px; font-size: 10px; }
  .speed { width: 24px; text-align: center; color: #fff; font-size: 13px; font-variant-numeric: tabular-nums; }
  .progress { color: rgba(255,255,255,0.4); font-size: 10px; }
`;

function button(className: string, label: string, text: string): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  el.setAttribute("aria-label", label);
  el.textContent = text;
  return el;
}

export class ScrollWidget {
  private host: HTMLDivElement;
  private root: ShadowRoot;
  private card: HTMLDivElement;
  private ring: SVGCircleElement;
  private playButton: HTMLButtonElement;
  private collapseButton: HTMLButtonElement;
  private speedLabel: HTMLSpanElement;
  private progressLabel: HTMLSpanElement;
  private pos = { x: 16, y: 100 };
  private dragging = false;
  private dragOffset = { x: 0, y: 0 };
  private moved = false;
  private collapsed = false;

  constructor(private callbacks: WidgetCallbacks) {
    this.host = document.createElement("div");
    this.host.style.cssText = "all: initial; position: fixed; z-index: 2147483647;";
    this.root = this.host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = STYLE;

    this.card = document.createElement("div");
    this.card.className = "card";

    const dial = document.createElement("div");
    dial.className = "dial";

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "48");
    svg.setAttribute("height", "48");
    svg.setAttribute("viewBox", "0 0 48 48");

    const track = document.createElementNS(SVG_NS, "circle");
    track.setAttribute("cx", "24");
    track.setAttribute("cy", "24");
    track.setAttribute("r", String(RADIUS));
    track.setAttribute("fill", "none");
    track.setAttribute("stroke", "rgba(255,255,255,0.1)");
    track.setAttribute("stroke-width", "3");

    this.ring = document.createElementNS(SVG_NS, "circle");
    this.ring.setAttribute("cx", "24");
    this.ring.setAttribute("cy", "24");
    this.ring.setAttribute("r", String(RADIUS));
    this.ring.setAttribute("fill", "none");
    this.ring.setAttribute("stroke", "rgba(255,255,255,0.2)");
    this.ring.setAttribute("stroke-width", "3");
    this.ring.setAttribute("stroke-linecap", "round");
    this.ring.setAttribute("transform", "rotate(-90 24 24)");
    this.ring.setAttribute("stroke-dasharray", `0 ${CIRCUMFERENCE}`);

    svg.append(track, this.ring);

    this.playButton = button("play", "Toggle auto-scroll", GLYPH.play);
    dial.append(svg, this.playButton);

    const slower = button("btn slower", "Slower", GLYPH.minus);
    const faster = button("btn faster", "Faster", GLYPH.plus);
    this.speedLabel = document.createElement("span");
    this.speedLabel.className = "speed";
    this.speedLabel.textContent = "30";

    const row = document.createElement("div");
    row.className = "row expanded";
    row.append(slower, this.speedLabel, faster);

    this.progressLabel = document.createElement("span");
    this.progressLabel.className = "progress expanded";
    this.progressLabel.textContent = "0%";

    this.collapseButton = button("btn small collapse", "Collapse", GLYPH.up);

    this.card.append(dial, row, this.progressLabel, this.collapseButton);
    this.root.append(style, this.card);
    document.documentElement.appendChild(this.host);

    this.tap(this.playButton, () => this.callbacks.onToggle());
    this.tap(slower, () => this.callbacks.onSpeedChange(-5));
    this.tap(faster, () => this.callbacks.onSpeedChange(5));
    this.tap(this.collapseButton, () => this.toggleCollapsed());

    this.card.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("resize", this.clampAndApply);
    this.clampAndApply();

    widgetPosition
      .getValue()
      .then((p) => {
        this.pos = p;
        this.clampAndApply();
      })
      .catch(() => {});
  }

  // Buttons sit inside the drag surface, so a press that moved is a drag, not a tap.
  private tap(el: HTMLElement, run: () => void) {
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.addEventListener("pointerup", (e) => {
      e.stopPropagation();
      if (!this.moved) run();
    });
  }

  private onPointerDown = (e: PointerEvent) => {
    this.dragging = true;
    this.moved = false;
    this.dragOffset = { x: e.clientX - this.pos.x, y: e.clientY - this.pos.y };
    this.card.setPointerCapture(e.pointerId);
    this.card.addEventListener("pointermove", this.onPointerMove);
    this.card.addEventListener("pointerup", this.onPointerUp);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.moved = true;
    this.pos = { x: e.clientX - this.dragOffset.x, y: e.clientY - this.dragOffset.y };
    this.clampAndApply();
  };

  private onPointerUp = () => {
    this.dragging = false;
    this.card.removeEventListener("pointermove", this.onPointerMove);
    this.card.removeEventListener("pointerup", this.onPointerUp);
    if (this.moved) widgetPosition.setValue(this.pos).catch(() => {});
  };

  private clampAndApply = () => {
    const rect = this.card.getBoundingClientRect();
    const w = rect.width || 76;
    const h = rect.height || 140;
    this.pos = {
      x: Math.max(0, Math.min(window.innerWidth - w, this.pos.x)),
      y: Math.max(0, Math.min(window.innerHeight - h, this.pos.y)),
    };
    this.card.style.left = `${this.pos.x}px`;
    this.card.style.top = `${this.pos.y}px`;
  };

  private toggleCollapsed() {
    this.collapsed = !this.collapsed;
    this.card.classList.toggle("collapsed", this.collapsed);
    this.collapseButton.textContent = this.collapsed ? GLYPH.down : GLYPH.up;
    this.clampAndApply();
  }

  update(state: { isScrolling: boolean; progress: number; currentSpeed: number }) {
    this.playButton.textContent = state.isScrolling ? GLYPH.pause : GLYPH.play;
    this.playButton.classList.toggle("on", state.isScrolling);
    this.ring.setAttribute("stroke", state.isScrolling ? "#10b981" : "rgba(255,255,255,0.2)");
    this.ring.setAttribute(
      "stroke-dasharray",
      `${(state.progress / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`,
    );
    this.speedLabel.textContent = String(state.currentSpeed);
    this.progressLabel.textContent = `${Math.round(state.progress)}%`;
  }

  destroy() {
    window.removeEventListener("resize", this.clampAndApply);
    this.host.remove();
  }
}
