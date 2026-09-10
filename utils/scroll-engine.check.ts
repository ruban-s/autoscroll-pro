// Run: bun utils/scroll-engine.check.ts
import assert from "node:assert";

type Fake = {
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
  overflowY: string;
  overflowX: string;
  parentElement: Fake | null;
};

function el(over: Partial<Fake> = {}): Fake {
  return {
    scrollHeight: 100,
    clientHeight: 100,
    scrollWidth: 100,
    clientWidth: 100,
    overflowY: "visible",
    overflowX: "visible",
    parentElement: null,
    ...over,
  };
}

const html = el({ scrollHeight: 100, clientHeight: 100 });
const body = el({ parentElement: html });

(globalThis as any).getComputedStyle = (e: Fake) => e;
(globalThis as any).window = { innerWidth: 1000, innerHeight: 800 };
(globalThis as any).document = {
  scrollingElement: html,
  documentElement: html,
  body,
  elementsFromPoint: () => stack,
};
let stack: Fake[] = [];

const { isScrollable, pickScrollTarget } = await import("./scroll-engine");
const pick = pickScrollTarget as unknown as (h: Fake | null, v: boolean) => Fake;
const canScroll = isScrollable as unknown as (e: Fake, v: boolean) => boolean;

// A non-overflow <article> is not a scroller even though it is tall.
const article = el({ scrollHeight: 8000, clientHeight: 8000, parentElement: body });
assert.equal(canScroll(article, true), false, "tall non-overflow element");

// ...so the hint must fall through to the document.
html.scrollHeight = 9000;
assert.equal(pick(article, true), html, "falls back to document");

// A real overflow container wins over the document.
const reader = el({
  scrollHeight: 8000,
  clientHeight: 800,
  overflowY: "auto",
  parentElement: body,
});
assert.equal(pick(reader, true), reader, "overflow container is the target");

// App shell: document does not scroll, so the element under the viewport wins.
html.scrollHeight = 100;
stack = [el({ parentElement: body }), reader, body, html];
assert.equal(pick(null, true), reader, "viewport-center scroller");

// Nothing scrollable anywhere still yields a usable target.
stack = [];
assert.equal(pick(null, true), html, "always returns an element");

// Axis matters: a vertical scroller is not a horizontal one.
assert.equal(canScroll(reader, false), false, "vertical scroller, horizontal axis");

console.log("ok");
