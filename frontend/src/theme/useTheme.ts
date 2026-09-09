import { useLayoutEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "aibom-theme";

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    return null;
  }
}

/** Dark by default; a first-ever visit (no stored preference) honors the OS setting. */
export function getInitialTheme(): Theme {
  const stored = readStoredTheme();
  if (stored) return stored;
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }
  return "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Layout effect (not a plain effect): applies before the browser paints,
  // avoiding a flash of the CSS-default (dark) theme when the stored/system
  // preference is light. No inline bootstrap script in index.html for this —
  // that would need 'unsafe-inline' in script-src and weaken the CSP.
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggle() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore — theme still applies for this session */
      }
      return next;
    });
  }

  return [theme, toggle];
}
