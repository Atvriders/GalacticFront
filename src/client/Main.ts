/**
 * Client bootstrap for GalacticFront.io
 */

const DARK_MODE_KEY = "gf_dark_mode";

function initDarkMode(): void {
  const stored = localStorage.getItem(DARK_MODE_KEY);
  const prefersDark =
    stored === null
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : stored === "true";

  if (prefersDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function setDarkMode(enabled: boolean): void {
  localStorage.setItem(DARK_MODE_KEY, String(enabled));
  if (enabled) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function setupNavigation(): void {
  // Navigation placeholder - will be populated by Lit components
  const sidebar = document.getElementById("sidebar-nav");
  if (sidebar) {
    sidebar.dataset.initialized = "true";
  }
}

export function init(): void {
  initDarkMode();
  setupNavigation();
  console.log("[GalacticFront] Client initialized");
}

// Auto-init on module load
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
