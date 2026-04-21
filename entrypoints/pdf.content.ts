import { findPdfScrollContainer } from "@/utils/pdf-handler";
import { sendMessage } from "@/utils/messaging";

export default defineContentScript({
  matches: [
    "*://*/*.pdf",
    "*://*/*.pdf?*",
    "*://docs.google.com/viewer*",
    "*://drive.google.com/*/preview*",
  ],
  runAt: "document_idle",

  main() {
    const selector = findPdfScrollContainer(document);
    if (!selector) return;

    const container = document.querySelector(selector);
    if (!container) return;

    sendMessage("scroll:updateConfig", {
      speed: 20,
    }).catch(() => {});
  },
});
