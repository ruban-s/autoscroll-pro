import { detectContentType } from "@/utils/content-detector";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main() {
    const result = detectContentType(document, window.location.href);

    if (result.type !== "general" && result.confidence >= 0.3) {
      browser.runtime.sendMessage({
        type: "content:detected",
        data: {
          type: result.type,
          confidence: result.confidence,
          scrollContainer: result.metadata.scrollContainer,
          nextChapterUrl: result.metadata.nextChapterUrl,
        },
      }).catch(() => {});
    }
  },
});
