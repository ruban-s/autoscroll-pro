import type { DetectionResult } from "@/types";

const PDF_URL_PATTERNS = [
  /\.pdf(\?|$|#)/i,
  /\/ViewerJS\//,
  /docs\.google\.com\/viewer/,
  /drive\.google\.com\/.*\/preview/,
  /mozilla\.github\.io\/pdf\.js/,
];

const PDF_VIEWER_SELECTORS: Record<string, string> = {
  "#viewerContainer": "pdfjs",
  "#viewer": "chrome-builtin",
  ".ndfHFb-c4YZDc": "google-drive",
  'embed[type="application/pdf"]': "embed",
};

export function detectPdf(
  doc: Document,
  url: string,
): DetectionResult | null {
  for (const pattern of PDF_URL_PATTERNS) {
    if (pattern.test(url)) {
      return {
        type: "pdf",
        confidence: 0.9,
        metadata: {
          scrollContainer: findPdfScrollContainer(doc),
          isPdfEmbed: false,
        },
      };
    }
  }

  const embed = doc.querySelector(
    'embed[type="application/pdf"], object[type="application/pdf"]',
  );
  if (embed) {
    return {
      type: "pdf",
      confidence: 0.85,
      metadata: { isPdfEmbed: true },
    };
  }

  const pdfIframe = doc.querySelector(
    'iframe[src*=".pdf"], iframe[src*="viewer"]',
  );
  if (pdfIframe) {
    return {
      type: "pdf",
      confidence: 0.7,
      metadata: { isPdfEmbed: true },
    };
  }

  return null;
}

export function findPdfScrollContainer(doc: Document): string | undefined {
  for (const [selector, _viewer] of Object.entries(PDF_VIEWER_SELECTORS)) {
    if (doc.querySelector(selector)) {
      return selector;
    }
  }
  return undefined;
}
