# CLAUDE.md

AutoScroll Pro — cross-browser auto-scroll extension for PDFs, manga/manhwa, blogs, and general pages. WXT (MV3), React 19, Tailwind CSS 4, TypeScript.

## Commands

pnpm. `dev`/`build`/`zip` target Chrome; `:firefox` variants and `build:all`/`zip:all` exist (see `package.json`).

```bash
pnpm check                         # tsc --noEmit
pnpm lint                          # biome check . (lint:fix / format to write)
bun utils/scroll-engine.check.ts   # assert-based check of isScrollable/pickScrollTarget; no test runner
```

`postinstall` runs `wxt prepare`, which generates `.wxt/` (types + tsconfig paths). `@/` and `~/` both resolve to the project root; types are barrel-exported, import via `@/types`.

## Architecture

- `entrypoints/background/index.ts` — Service worker. Orchestrates keyboard commands, badge updates, and message routing. Never scrolls directly. **The MV3 worker is evicted while idle, so it holds no module-level state** — toggle state is read back from the page via `scroll:getState`, and per-tab state (content type, next chapter, pending auto-start) lives in `session:` storage, which survives eviction but not the browser session that owns those tab ids. `storage.session` is why `strict_min_version` is `115.0`. **Firefox for Android implements neither `commands` nor `contextMenus`**, so both are feature-detected; touching them at top level throws and takes the whole background script down. Badge calls go through `setBadge()`, which swallows rejections because Android has `action` without badge support.
- `entrypoints/scroller.content.ts` — The only content script, injected on all URLs. Runs content detection, instantiates `ScrollEngine`, owns the floating widget and the container picker, listens for control messages from background/popup.
- `utils/widget.ts` — The floating on-page control, built with plain DOM in a closed shadow root. Deliberately not React: it lives inside the scroller, so it calls the engine directly instead of round-tripping messages, and it adds no framework to every page. **Do not use `innerHTML`** — AMO flags it, and commit `656e7c0` already removed it once.
- `utils/picker.ts` — "Pick scroll area" mode. `buildSelector()` grows a selector path upward until `document.querySelector(path)` resolves back to the element it started on; returning an ancestor's selector early is the bug it was written to avoid.
- `utils/scroll-engine.ts` (`ScrollEngine`) — sub-pixel remainder carries between frames so speed 1 still moves. Stops at end only after `END_GRACE_MS` with no growth in `scrollHeight`, so lazy-loaded and infinite-scroll pages keep going.

**Picking the scroll target is the part that breaks pages.** Never assume the document scrolls, and never trust a detector's `scrollContainer` selector — those selectors (`article`, `.reader-area`) name the *content*, which is usually not the scroller. `pickScrollTarget()` validates a candidate with `isScrollable()` (needs real overflow room *and* an `overflow` of auto/scroll/overlay), climbs to the nearest scrollable ancestor, falls back to the document, then to whatever scrolls under the viewport centre (`elementsFromPoint`) for app-shell layouts. Scrolling uses `scrollTo({ behavior: "instant" })` — a plain `scrollTop +=` is animated by a page's CSS `scroll-behavior: smooth` and fights every frame. `scroll-snap-type` is disabled on the target while scrolling and restored on stop.

**Message passing** is raw `browser.runtime.onMessage` with `{ type, data }` envelopes, typed by `ProtocolMap` (`types/messaging.ts`) as the documented contract. All messages are namespaced (e.g., `scroll:start`, `scroll:stateChanged`, `content:detected`). Flow: Popup → Background → Content Script for start/stop/config (popup messages the tab directly for `scroll:getState`, `picker:start`, and remembered speed), and Content Script → Background for events. The content script sends its own `location.href` with `content:detected`; the background must not read `sender.tab.url`, which needs a host permission this extension does not request.

**Storage** (`utils/storage.ts`) uses WXT's `storage.defineItem` from `wxt/utils/storage`. Settings use `sync:` prefix (cross-device), runtime state uses `local:`, per-tab background state uses `session:`. Note `storage.sync` does not sync to a Mozilla account on Firefox for Android, so mobile settings are effectively local. **`resumePositions` must stay `local:`** — it holds up to 50 full hrefs, which overflows `storage.sync`'s 8 KB per-item quota and makes every write fail.

Per-site state (`local:siteSpeeds`, `local:siteContainers`) is keyed by hostname. Speed is only remembered when the `scroll:updateConfig` message carries `remember: true` — the background reuses that same message to push content-type speed zones, and those must not stick, or a zone edit in options would never apply again. **Speed precedence is pinned-per-site > content-type zone > default**, enforced in `applyConfig()`: once a site has a pinned speed, incoming `speed` without `remember` is dropped. Without that, the zone push that lands right after detection silently overwrites the speed just restored from memory.

## Store Policy

Chrome Web Store rejected 0.2.0 under **Use of Permissions** for declaring `scripting` and never calling it. Only request a permission the code actually uses — `permissions` is now `["storage", "contextMenus"]`. `activeTab` went too: nothing called it once the content script started sending its own URL.

## Known Limitations

- **Chrome's built-in PDF viewer cannot be scrolled.** It renders inside an internal plugin document that content scripts cannot reach, so the `#viewer` entry in `pdf-handler.ts` never matches there. PDF auto-scroll works on pdf.js viewers (including Firefox's) only.
- **Top frame only.** `allFrames` is off, so content inside a cross-origin iframe will not scroll. Turning it on would make every ad frame run its own engine and fight over the badge.

## Git Commit Rules

- **No author attribution.** Never add `Co-Authored-By` or similar lines.
- Subject `<prefix>: <what>`, under 72 chars, describes what not how. Prefixes: `feat:`, `fix:`, `refactor:`, `chore:` (tooling, deps, config), `docs:`.
- **Single-line messages only**, no body.
