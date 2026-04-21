import { ScrollEngine } from "@/utils/scroll-engine";
import { onMessage, sendMessage } from "@/utils/messaging";
import { defaultConfig } from "@/utils/storage";
import type { ScrollConfig } from "@/types";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  async main() {
    const config = await defaultConfig.getValue();
    const engine = new ScrollEngine(config);

    engine.setCallbacks({
      onStateChange: (state) => {
        sendMessage("scroll:stateChanged", state).catch(() => {});
      },
      onFinished: () => {
        sendMessage("scroll:finished", undefined).catch(() => {});
      },
      onInteractionPause: () => {
        sendMessage("scroll:interactionPause", undefined).catch(() => {});
      },
    });

    onMessage("scroll:start", ({ data }) => {
      engine.updateConfig(data as ScrollConfig);
      engine.start();
    });

    onMessage("scroll:stop", () => {
      engine.stop();
    });

    onMessage("scroll:updateConfig", ({ data }) => {
      engine.updateConfig(data as Partial<ScrollConfig>);
    });

    onMessage("scroll:getState", () => {
      return engine.getState();
    });
  },
});
