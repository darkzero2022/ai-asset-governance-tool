import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
function withOpacity(variable) {
  return `rgb(var(${variable}) / <alpha-value>)`;
}

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // No dark: variant usage — every color is a CSS custom property that
  // already swaps value under :root[data-theme="light"] (see theme/tokens.css),
  // so the same utility class (bg-surface, text-subtle, ...) is theme-correct
  // in both themes without a Tailwind dark-mode strategy at all.
  theme: {
    extend: {
      colors: {
        bg: withOpacity("--wz-bg"),
        surface: withOpacity("--wz-surface"),
        "surface-alt": withOpacity("--wz-surface-alt"),
        border: withOpacity("--wz-border"),
        text: withOpacity("--wz-text"),
        subtle: withOpacity("--wz-text-subtle"),
        disabled: withOpacity("--wz-text-disabled"),
        primary: {
          DEFAULT: withOpacity("--wz-primary"),
          hover: withOpacity("--wz-primary-hover"),
        },
        cyan: withOpacity("--wz-cyan"),
        indigo: withOpacity("--wz-indigo"),
        success: withOpacity("--wz-success"),
        warning: withOpacity("--wz-warning"),
        danger: withOpacity("--wz-danger"),
        info: withOpacity("--wz-info"),
        severity: {
          critical: withOpacity("--wz-severity-critical"),
          high: withOpacity("--wz-severity-high"),
          medium: withOpacity("--wz-severity-medium"),
          low: withOpacity("--wz-severity-low"),
          none: withOpacity("--wz-severity-none"),
        },
        chart: {
          1: withOpacity("--wz-chart-1"),
          2: withOpacity("--wz-chart-2"),
          3: withOpacity("--wz-chart-3"),
          4: withOpacity("--wz-chart-4"),
          5: withOpacity("--wz-chart-5"),
          6: withOpacity("--wz-chart-6"),
          7: withOpacity("--wz-chart-7"),
          8: withOpacity("--wz-chart-8"),
        },
      },
      fontFamily: {
        sans: ["var(--wz-font-sans)"],
        mono: ["var(--wz-font-mono)"],
      },
      borderRadius: {
        sm: "var(--wz-radius-sm)",
        md: "var(--wz-radius-md)",
        lg: "var(--wz-radius-lg)",
      },
      boxShadow: {
        card: "var(--wz-shadow-card)",
      },
      spacing: {
        "row-compact": "var(--wz-row-compact)",
        "row-default": "var(--wz-row-default)",
        "sidebar-expanded": "var(--wz-sidebar-expanded)",
        "sidebar-collapsed": "var(--wz-sidebar-collapsed)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
