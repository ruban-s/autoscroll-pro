import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "AutoScroll Pro",
    description:
      "Hands-free scrolling for blogs, manga, PDFs and web apps. No host permissions, no tracking.",
    icons: {
      "16": "assets/icons/icon-16.png",
      "32": "assets/icons/icon-32.png",
      "48": "assets/icons/icon-48.png",
      "128": "assets/icons/icon-128.png",
    },
    browser_specific_settings: {
      gecko: {
        id: "autoscroll-pro@ruban.dev",
        strict_min_version: "109.0",
        data_collection_permissions: {
          required: ["none"],
          optional: [],
        },
      },
      gecko_android: {},
    },
    permissions: ["storage", "contextMenus"],
    commands: {
      "toggle-scroll": {
        suggested_key: { default: "Alt+S" },
        description: "Start/stop auto-scroll",
      },
      "speed-up": {
        suggested_key: { default: "Alt+Up" },
        description: "Increase scroll speed",
      },
      "speed-down": {
        suggested_key: { default: "Alt+Down" },
        description: "Decrease scroll speed",
      },
    },
  },
});
