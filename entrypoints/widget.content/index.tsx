import ReactDOM from "react-dom/client";
import App from "./App";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  allFrames: false,

  async main(ctx) {
    if (window !== window.top) return;
    const ui = await createShadowRootUi(ctx, {
      name: "autoscroll-pro-widget",
      position: "overlay",
      zIndex: 2147483647,
      onMount(container) {
        container.style.pointerEvents = "none";
        const wrapper = document.createElement("div");
        wrapper.style.pointerEvents = "auto";
        wrapper.style.width = "fit-content";
        container.append(wrapper);
        const root = ReactDOM.createRoot(wrapper);
        root.render(<App />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
