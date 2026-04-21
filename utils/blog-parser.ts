import type { DetectionResult } from "@/types";

const ARTICLE_SELECTORS = [
  "article",
  '[role="article"]',
  '[role="main"]',
  ".post-content",
  ".entry-content",
  ".article-body",
  ".article-content",
  ".blog-post",
  ".post-body",
  "main article",
];

const BLOG_PLATFORM_INDICATORS = [
  ".wp-content",
  'meta[name="generator"][content*="WordPress"]',
  'meta[property="al:web:url"][content*="medium.com"]',
  ".graf",
  'meta[property="og:site_name"][content*="Substack"]',
  ".post-content",
  "article.h-entry",
];

export function detectBlog(doc: Document): DetectionResult | null {
  let confidence = 0;
  let scrollContainer: string | undefined;
  let articleSections = 0;

  for (const selector of ARTICLE_SELECTORS) {
    const el = doc.querySelector(selector);
    if (el) {
      confidence += 0.3;
      scrollContainer = selector;

      const blocks = el.querySelectorAll(
        "p, h2, h3, h4, blockquote, pre, figure",
      );
      articleSections = blocks.length;

      if (articleSections > 5) confidence += 0.2;
      break;
    }
  }

  for (const selector of BLOG_PLATFORM_INDICATORS) {
    if (doc.querySelector(selector)) {
      confidence += 0.25;
      break;
    }
  }

  const textContent = doc.body?.textContent || "";
  const htmlLength = doc.body?.innerHTML.length || 1;
  const textRatio = textContent.length / htmlLength;
  if (textRatio > 0.3) {
    confidence += 0.15;
  }

  if (confidence < 0.3) return null;

  return {
    type: "blog",
    confidence: Math.min(confidence, 1),
    metadata: {
      scrollContainer,
      articleSections,
    },
  };
}
