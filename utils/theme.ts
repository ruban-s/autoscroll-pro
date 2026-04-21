import { theme } from "./storage";

export async function applyTheme() {
  const value = await theme.getValue();
  updateClass(value);

  theme.watch((newValue) => {
    updateClass(newValue);
  });
}

function updateClass(value: "light" | "dark" | "system") {
  const isDark =
    value === "dark" ||
    (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", isDark);
}
