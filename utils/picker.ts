import { isScrollable } from "./scroll-engine";

// Good enough to re-find the element on reload; not a general-purpose serializer.
export function buildSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const parts: string[] = [];
  let node: Element | null = el;

  // Grow the path upwards until it resolves back to the element we started on.
  while (node && node !== document.documentElement && parts.length < 8) {
    const tag = node.tagName.toLowerCase();
    const stable = Array.from(node.classList).find((c) => !/\d/.test(c));
    const parent: Element | null = node.parentElement;

    if (stable) {
      parts.unshift(`${tag}.${CSS.escape(stable)}`);
    } else {
      const index = parent ? Array.from(parent.children).indexOf(node) + 1 : 1;
      parts.unshift(`${tag}:nth-child(${index})`);
    }

    const path = parts.join(" > ");
    if (document.querySelector(path) === el) return path;

    node = parent;
  }

  return parts.join(" > ");
}

export class ContainerPicker {
  private overlay: HTMLDivElement;
  private hint: HTMLDivElement;
  private current: Element | null = null;

  constructor(private onPick: (el: Element, selector: string) => void) {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `
      all: initial; position: fixed; z-index: 2147483646; pointer-events: none;
      border: 2px solid #10b981; background: rgba(16,185,129,0.15);
      border-radius: 4px; transition: all 0.05s linear;
    `;

    this.hint = document.createElement("div");
    this.hint.style.cssText = `
      all: initial; position: fixed; z-index: 2147483647; left: 50%; top: 16px;
      transform: translateX(-50%); padding: 8px 14px; border-radius: 999px;
      background: #1a1a2e; color: #fff; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px; pointer-events: none;
    `;
    this.hint.textContent = "Click the area that should scroll · Esc to cancel";

    document.documentElement.append(this.overlay, this.hint);

    document.addEventListener("mousemove", this.onMove, true);
    document.addEventListener("click", this.onClick, true);
    document.addEventListener("keydown", this.onKey, true);
  }

  private onMove = (e: MouseEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === this.overlay || el === this.hint) return;
    this.current = el;
    const rect = el.getBoundingClientRect();
    this.overlay.style.left = `${rect.left}px`;
    this.overlay.style.top = `${rect.top}px`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;
    this.hint.textContent = isScrollable(el, true)
      ? `${el.tagName.toLowerCase()} · scrollable · click to use`
      : `${el.tagName.toLowerCase()} · not scrollable, will climb to nearest parent`;
  };

  private onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (this.current) this.onPick(this.current, buildSelector(this.current));
    this.destroy();
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    this.destroy();
  };

  destroy() {
    document.removeEventListener("mousemove", this.onMove, true);
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("keydown", this.onKey, true);
    this.overlay.remove();
    this.hint.remove();
  }
}
