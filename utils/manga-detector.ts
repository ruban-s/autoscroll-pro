import type { DetectionResult } from "@/types";

const MANGA_URL_PATTERNS = [
  /mangadex\.org/,
  /webtoons?\.(com|io)/,
  /toonily\.com/,
  /manganato\.(com|to)/,
  /mangakakalot\.com/,
  /chapmanganato\.to/,
  /asura(scans|toon)/i,
  /reaperscans/i,
  /flamescans/i,
  /manhwa/i,
  /manhua/i,
  /manga.*read/i,
  /read.*manga/i,
];

const READER_SELECTORS = [
  ".reader-area",
  "#readerarea",
  ".chapter-content",
  ".reading-content",
  '[class*="chapter-reader"]',
  '[class*="manga-reader"]',
  ".container-chapter-reader",
  "#content-chapter",
];

const NEXT_CHAPTER_PATTERNS =
  /next\s*chapter|next\s*ep|다음\s*화|次.*話|siguiente/i;

export function detectManga(
  doc: Document,
  url: string,
): DetectionResult | null {
  let confidence = 0;
  let scrollContainer: string | undefined;
  let nextChapterUrl: string | undefined;

  for (const pattern of MANGA_URL_PATTERNS) {
    if (pattern.test(url)) {
      confidence += 0.4;
      break;
    }
  }

  for (const selector of READER_SELECTORS) {
    const el = doc.querySelector(selector);
    if (el) {
      confidence += 0.3;
      scrollContainer = selector;
      break;
    }
  }

  const images = doc.querySelectorAll(
    "img[src], img[data-src], img[data-lazy-src]",
  );
  let tallImageCount = 0;
  for (const img of images) {
    const el = img as HTMLImageElement;
    if (el.naturalHeight > 600 || el.height > 600) {
      tallImageCount++;
    }
  }
  if (tallImageCount >= 5) {
    confidence += 0.3;
  }

  const links = doc.querySelectorAll("a");
  for (const link of links) {
    if (NEXT_CHAPTER_PATTERNS.test(link.textContent || "")) {
      nextChapterUrl = link.href;
      break;
    }
  }

  if (confidence < 0.3) return null;

  return {
    type: "manga",
    confidence: Math.min(confidence, 1),
    metadata: {
      scrollContainer,
      nextChapterUrl,
    },
  };
}
