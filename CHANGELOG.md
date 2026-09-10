# Changelog

All notable changes to AutoScroll Pro are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-09-10

### Fixed

- **Auto-scroll did nothing on most blogs and manga/manhwa readers.** The
  detectors returned content selectors (`article`, `.reader-area`) as scroll
  containers. Those elements have no overflow, so `scrollTop` writes were a
  no-op and `isAtEnd()` returned true on the first frame, stopping the engine
  immediately. `pickScrollTarget()` now validates that a candidate has real
  overflow room and an `auto`/`scroll`/`overlay` overflow, climbs to the
  nearest scrollable ancestor, and falls back to the document.
- **Pages that scroll inside a panel rather than the window** (web apps,
  dashboards, app-shell layouts) now work. When the document itself does not
  scroll, the target is resolved from whatever scrolls under the viewport
  centre via `elementsFromPoint`.
- **Sites with CSS `scroll-behavior: smooth` stuttered or barely moved.** The
  page animated every per-frame `scrollTop` write and fought the engine.
  Scrolling now uses `scrollTo({ behavior: "instant" })`.
- **Snap-scrolling pages dragged each step back.** `scroll-snap-type` is
  disabled on the target while scrolling and restored on stop.
- **The lowest speed settings could fail to move at all.** The sub-pixel
  remainder is now carried between frames, so speed 1 (0.5px/frame) advances.
- **Scrolling stopped at a false bottom on infinite-scroll and lazy-loading
  pages.** The engine now stops only after `END_GRACE_MS` at the end with no
  growth in `scrollHeight`.
- **Alt+S only started scrolling and never stopped it** once the extension had
  been idle. Toggle state lived in a background `Map` that was empty by the
  time a keyboard command woke the evicted MV3 service worker. State is now
  read back from the page via `scroll:getState`.
- **The content type badge in the popup always read "general".**
  `setContentType()` had no caller, so `ScrollState.contentType` never changed
  from its default.
- **Back/forward cache was blocked.** Scroll positions save on `pagehide`
  instead of `beforeunload`.

### Changed

- Firefox builds now use Manifest V3. The `--browser firefox` scripts were
  emitting a Manifest V2 build.
- Content detection folded into the scroller, which can now set its own content
  type and scroll container. `detector.content.ts` and `pdf.content.ts` were
  removed, leaving one content script instead of three.
- Dropped the `@webext-core/messaging` dependency, which had no importers left.
  Message passing is raw `browser.runtime.onMessage` typed by `ProtocolMap`.

### Removed

- The `scripting` and `activeTab` permissions. Chrome Web Store rejected 0.2.0
  under **Use of Permissions** because `scripting` was declared and no code
  ever called `browser.scripting.*`. `activeTab` was unused once the content
  script started sending its own `location.href` with `content:detected`, which
  the background now reads instead of `sender.tab.url`. `permissions` is now
  `["storage", "contextMenus"]`.

### Known limitations

- Chrome's built-in PDF viewer cannot be auto-scrolled. It renders inside an
  internal plugin document that content scripts cannot reach. PDF.js viewers,
  including Firefox's, work.
- Content inside a cross-origin iframe will not scroll. `allFrames` is off, so
  only the top frame runs the engine.

## [0.2.0] - 2026-06-03

### Added

- Auto-advance to the next chapter when the scroll reaches the end, with
  auto-start once the new page loads.
- Scroll profiles apply automatically on page load when the site matches.
- Detected scroll containers are forwarded from the detector to the scroll
  engine.
- Content type badge in the popup.
- Full settings export and import from the About page.

### Fixed

- Auto-advance URLs are validated as same-origin `http`/`https` before
  navigating.
- Auto-start made reliable, resume positions synced, and scroll containers
  cached per tab.
- The About page reads the version from the manifest instead of a hardcoded
  string.

## [0.1.1] - 2026-05-13

### Fixed

- Scrolling used `document.scrollingElement` for Firefox compatibility.

## [0.1.0] - 2026-04-21

Initial release.

### Added

- Smooth and step scroll modes, speed 1 to 100, and four scroll directions.
- Content type detection for PDF, manga, blog, and infinite-scroll pages, with
  a configurable speed zone per type.
- Popup with play/pause, speed slider, direction picker, and progress bar.
- Options page with scroll profiles, speed zones, and shortcut settings.
- Context menu with a toggle and speed presets, plus keyboard commands
  (`Alt+S`, `Alt+Up`, `Alt+Down`).
- Focus mode that dims the viewport outside a reading strip.
- Resume positions saved and restored per URL.
- Auto-pause on user interaction with auto-resume after 2 seconds.
- Dark mode.

[0.2.1]: https://github.com/ruban-s/autoscroll-pro/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/ruban-s/autoscroll-pro/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ruban-s/autoscroll-pro/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ruban-s/autoscroll-pro/releases/tag/v0.1.0
