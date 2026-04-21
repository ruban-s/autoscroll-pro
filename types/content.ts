import type { ContentType } from "./scroll";

export interface DetectionResult {
  type: ContentType;
  confidence: number;
  metadata: {
    scrollContainer?: string;
    nextChapterUrl?: string;
    articleSections?: number;
    isPdfEmbed?: boolean;
  };
}
