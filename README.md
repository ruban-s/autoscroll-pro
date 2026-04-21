# AutoScroll Pro

I built this because I got tired of manually scrolling through long manhwa chapters and PDF documents. Most auto-scroll extensions I tried were either abandoned, didn't work on Firefox, or couldn't handle different types of content well. So I made my own.

AutoScroll Pro is a browser extension that auto-scrolls any webpage — it figures out what kind of content you're reading and adjusts accordingly. Manga gets scrolled faster, PDFs slower, blogs at a comfortable reading pace. Works on Chrome, Firefox, and Edge.

## What it does

- **Detects what you're reading** — Recognizes PDFs, manga/manhwa sites, blogs, and infinite-scroll pages automatically. Each content type gets its own default scroll speed.
- **Scroll in any direction** — Down, up, left, right. Useful for horizontal manga readers or wide dashboards.
- **Two scroll modes** — Smooth continuous scrolling, or step-by-step jumps (like page turns).
- **Pauses when you interact** — If you scroll with your mouse, click something, or tap the screen, it pauses automatically and picks back up after 2 seconds.
- **Timer mode** — Set it to stop after a certain number of minutes. Good for reading sessions.
- **Per-site profiles** — Save different scroll settings for different websites using URL patterns.
- **Keyboard shortcuts** — `Alt+S` to toggle, `Alt+Up/Down` to adjust speed on the fly.
- **Right-click menu** — Quick access to toggle scrolling and speed presets.
- **Dark mode** — Follows your system preference, or set it manually to light/dark.
- **Import/export profiles** — Back up your settings or share them.

## Getting started

You'll need [Node.js](https://nodejs.org/) (18+) and [pnpm](https://pnpm.io/).

```bash
git clone https://github.com/ruban-s/autoscroll-pro.git
cd autoscroll-pro
pnpm install
```

### Chrome or Edge

```bash
pnpm build
```

Then go to `chrome://extensions`, turn on Developer Mode, click "Load unpacked", and select the `.output/chrome-mv3/` folder.

### Firefox

```bash
pnpm build:firefox
```

Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", and pick any file inside `.output/firefox-mv2/`.

### Development

```bash
pnpm dev            # starts dev server for Chrome with hot reload
pnpm dev:firefox    # same but for Firefox
pnpm check          # run TypeScript type checking
```

The extension auto-reloads when you save changes.

## How the speed works

Speed is a value from 1 to 100. It maps to an exponential curve — low speeds give you fine-grained control for reading, higher speeds ramp up quickly for skimming.

The extension assigns default speeds based on what it detects:

| Content type    | Default speed | Why                                    |
| --------------- | ------------- | -------------------------------------- |
| General         | 30            | Reasonable default for most pages      |
| PDF             | 20            | Dense text, needs slower pace          |
| Manga           | 50            | Mostly images, faster feels natural    |
| Blog            | 25            | Comfortable reading speed              |
| Infinite scroll | 35            | Slightly faster to keep up with loads  |

You can change all of these in the options page under Speed Zones.

## Shortcuts

| Key         | Action               |
| ----------- | -------------------- |
| `Alt+S`     | Start/stop scrolling |
| `Alt+Up`    | Speed up             |
| `Alt+Down`  | Slow down            |

These can be remapped in your browser's extension shortcut settings.

## Built with

- [WXT](https://wxt.dev) for the extension framework (Manifest V3)
- [React](https://react.dev) for the popup and options UI
- [Tailwind CSS](https://tailwindcss.com) for styling
- TypeScript throughout

## Contributing

If you find a bug or want to add support for a specific site, feel free to open an issue or PR. The content detection lives in `utils/manga-detector.ts`, `utils/blog-parser.ts`, and `utils/pdf-handler.ts` — adding new site patterns is usually just a regex.

## License

MIT License — see [LICENSE](LICENSE) for details.
