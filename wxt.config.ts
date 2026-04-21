import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "AutoScroll Pro",
    description: "Smart auto-scroll for PDFs, manga, blogs, and the web",
    icons: {
      "16": "assets/icons/icon-16.png",
      "32": "assets/icons/icon-32.png",
      "48": "assets/icons/icon-48.png",
      "128": "assets/icons/icon-128.png",
    },
    browser_specific_settings: {
      gecko: {
        id: "autoscroll-pro@ruban.dev",
        data_collection_permissions: {
          required: ["none"],
          optional: [],
        },
      },
    },
    permissions: ["activeTab", "scripting", "storage", "contextMenus"],
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
