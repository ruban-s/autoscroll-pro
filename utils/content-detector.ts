import type { ContentType, DetectionResult } from "@/types";
import { detectPdf } from "./pdf-handler";
import { detectManga } from "./manga-detector";
import { detectBlog } from "./blog-parser";

export function detectContentType(
  doc: Document,
  url: string,
): DetectionResult {
  const detectors: Array<() => DetectionResult | null> = [
    () => detectPdf(doc, url),
    () => detectManga(doc, url),
    () => detectBlog(doc),
    () => detectInfiniteScroll(doc),
  ];

  let best: DetectionResult = {
    type: "general",
    confidence: 0,
    metadata: {},
  };

  for (const detect of detectors) {
    const result = detect();
    if (result && result.confidence > best.confidence) {
      best = result;
    }
  }

  return best;
}

function detectInfiniteScroll(doc: Document): DetectionResult | null {
  const sentinels = doc.querySelectorAll(
    '[class*="infinite-scroll"], [class*="load-more"], [data-infinite], [class*="sentinel"]',
  );

  if (sentinels.length > 0) {
    return {
      type: "infinite-scroll",
      confidence: 0.6,
      metadata: {},
    };
  }

  const lazyImages = doc.querySelectorAll(
    'img[loading="lazy"], img[data-src], img[data-lazy]',
  );
  if (lazyImages.length > 10) {
    return {
      type: "infinite-scroll",
      confidence: 0.4,
      metadata: {},
    };
  }

  return null;
}
