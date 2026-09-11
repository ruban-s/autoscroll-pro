import type { ResumePosition } from "./profile";
import type { ContentType, ScrollConfig, ScrollState } from "./scroll";

export interface ProtocolMap {
  "scroll:start": (config: ScrollConfig) => void;
  "scroll:stop": () => void;
  "scroll:updateConfig": (config: Partial<ScrollConfig>) => void;
  "scroll:getState": () => ScrollState;
  "scroll:stateChanged": (state: ScrollState) => void;
  "scroll:finished": () => void;
  "scroll:interactionPause": () => void;
  "picker:start": () => void;
  "content:detected": (result: {
    type: ContentType;
    confidence: number;
    url: string;
    nextChapterUrl?: string;
  }) => void;
  "resume:save": (pos: ResumePosition) => void;
  "resume:get": (url: string) => ResumePosition | null;
  "resume:restore": (pos: ResumePosition) => void;
}
