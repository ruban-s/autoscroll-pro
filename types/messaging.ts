import type { ScrollConfig, ScrollState, ContentType } from "./scroll";
import type { ScrollProfile } from "./profile";
import type { ResumePosition } from "./profile";

export interface ProtocolMap {
  "scroll:start": (config: ScrollConfig) => void;
  "scroll:stop": () => void;
  "scroll:updateConfig": (config: Partial<ScrollConfig>) => void;
  "scroll:getState": () => ScrollState;
  "scroll:stateChanged": (state: ScrollState) => void;
  "scroll:finished": () => void;
  "scroll:interactionPause": () => void;
  "content:detected": (result: {
    type: ContentType;
    confidence: number;
  }) => void;
  "profile:getForSite": (url: string) => ScrollProfile | null;
  "profile:save": (profile: ScrollProfile) => void;
  "resume:save": (pos: ResumePosition) => void;
  "resume:get": (url: string) => ResumePosition | null;
}
