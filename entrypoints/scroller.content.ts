import { ScrollEngine } from "@/utils/scroll-engine";
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
        browser.runtime.sendMessage({ type: "scroll:stateChanged", data: state }).catch(() => {});
      },
      onFinished: () => {
        browser.runtime.sendMessage({ type: "scroll:finished" }).catch(() => {});
      },
      onInteractionPause: () => {
        browser.runtime.sendMessage({ type: "scroll:interactionPause" }).catch(() => {});
      },
    });

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const { type, data } = message;

      switch (type) {
        case "scroll:start":
          engine.updateConfig(data as ScrollConfig);
          engine.start();
          break;
        case "scroll:stop":
          engine.stop();
          break;
        case "scroll:updateConfig":
          engine.updateConfig(data as Partial<ScrollConfig>);
          break;
        case "scroll:getState":
          sendResponse(engine.getState());
          return;
      }
    });
  },
});
