export function getStoredTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("ped-theme", theme);
  } catch {
    // localStorage unavailable (private browsing, etc.) — theme just won't persist across reloads.
  }
}
