/**
 * Theme toggle.
 *
 * The *initial* theme is applied by a small blocking script in Base.astro, not
 * here — by the time a module script runs the first paint has already happened
 * and the page would visibly flash the wrong theme. This module only handles
 * the toggle and the "follow the system" case.
 */

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  for (const button of document.querySelectorAll<HTMLElement>("[data-theme-toggle]")) {
    button.setAttribute("aria-pressed", String(theme === "dark"));
    button.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
    );
  }
}

export function initTheme(): void {
  apply(current());

  for (const button of document.querySelectorAll<HTMLElement>("[data-theme-toggle]")) {
    button.addEventListener("click", () => {
      const next: Theme = current() === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private mode or blocked storage: the toggle still works for this
        // page view, it just will not be remembered.
      }
      apply(next);
    });
  }

  // Keep following the OS while the visitor has not made an explicit choice.
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", (event) => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored !== "light" && stored !== "dark") {
      apply(event.matches ? "dark" : "light");
    }
  });
}
