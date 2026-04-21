import type { ContentType, ScrollConfig } from "./scroll";

export interface ScrollProfile {
  id: string;
  name: string;
  config: Partial<ScrollConfig>;
  sitePatterns: string[];
  contentType?: ContentType;
  createdAt: number;
  updatedAt: number;
}

export interface ResumePosition {
  url: string;
  scrollTop: number;
  scrollLeft: number;
  timestamp: number;
}
