import { detectContentType } from "@/utils/content-detector";
import { sendMessage } from "@/utils/messaging";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main() {
    const result = detectContentType(document, window.location.href);

    if (result.type !== "general" && result.confidence >= 0.3) {
      sendMessage("content:detected", {
        type: result.type,
        confidence: result.confidence,
      }).catch(() => {});
    }
  },
});
