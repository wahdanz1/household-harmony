import type { Config } from "tailwindcss";

/**
 * Token integration:
 * - Tokens are stored as raw OKLCH triplets in CSS (`--accent: 0.56 0.13 152;`).
 * - Tailwind wraps them with `oklch(var(--name) / <alpha-value>)` so opacity
 *   modifiers (e.g. `bg-accent/80`) work natively.
 * - Pre-composed translucent vars (e.g. `--bg-trans`) are exposed as direct
 *   var-only colors and don't support opacity modifiers.
 */
const oklchVar = (name: string) => `oklch(var(${name}) / <alpha-value>)`;

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"DM Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // ─────────────────────────────────────────────
        // New design tokens (chlorophyll system)
        // ─────────────────────────────────────────────
        bg: oklchVar("--bg"),
        surface: oklchVar("--surface"),
        "surface-2": oklchVar("--surface-2"),
        ink: oklchVar("--ink"),
        "ink-2": oklchVar("--ink-2"),
        muted: oklchVar("--muted"),
        line: oklchVar("--line"),
        "line-2": oklchVar("--line-2"),
        accent: {
          DEFAULT: oklchVar("--accent"),
          dk: oklchVar("--accent-dk"),
          tint: oklchVar("--accent-tint"),
          ink: oklchVar("--accent-ink"),
        },
        danger: oklchVar("--danger"),
        warn: oklchVar("--warn"),

        // Pre-composed translucent (no alpha modifier)
        "bg-trans": "var(--bg-trans)",

        // ─────────────────────────────────────────────
        // Backwards-compat aliases (old names → new tokens)
        // Keep these until all primitives + pages migrate
        // ─────────────────────────────────────────────
        border: oklchVar("--border"),
        input: oklchVar("--input"),
        ring: oklchVar("--ring"),
        background: oklchVar("--background"),
        foreground: oklchVar("--foreground"),
        primary: {
          DEFAULT: oklchVar("--primary"),
          foreground: oklchVar("--primary-foreground"),
        },
        secondary: {
          DEFAULT: oklchVar("--secondary"),
          foreground: oklchVar("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: oklchVar("--destructive"),
          foreground: oklchVar("--destructive-foreground"),
        },
        success: {
          DEFAULT: oklchVar("--success"),
          foreground: oklchVar("--success-foreground"),
        },
        warning: {
          DEFAULT: oklchVar("--warning"),
          foreground: oklchVar("--warning-foreground"),
        },
        alert: {
          DEFAULT: oklchVar("--alert"),
          foreground: oklchVar("--alert-foreground"),
        },
        info: {
          DEFAULT: oklchVar("--info"),
          foreground: oklchVar("--info-foreground"),
        },
        "accent-purple": {
          DEFAULT: oklchVar("--accent-purple"),
          foreground: oklchVar("--accent-purple-foreground"),
        },
        // Old "muted" Tailwind name stays as a color object so `bg-muted` etc.
        // keeps working — points at surface-2 (the visual it always represented).
        // `text-muted-foreground` resolves via .foreground → --muted (text color).
        muted: {
          DEFAULT: oklchVar("--muted-bg"),
          foreground: oklchVar("--muted-foreground"),
        },
        popover: {
          DEFAULT: oklchVar("--popover"),
          foreground: oklchVar("--popover-foreground"),
        },
        card: {
          DEFAULT: oklchVar("--card"),
          foreground: oklchVar("--card-foreground"),
        },
        sidebar: {
          DEFAULT: oklchVar("--sidebar-background"),
          foreground: oklchVar("--sidebar-foreground"),
          primary: oklchVar("--sidebar-primary"),
          "primary-foreground": oklchVar("--sidebar-primary-foreground"),
          accent: oklchVar("--sidebar-accent"),
          "accent-foreground": oklchVar("--sidebar-accent-foreground"),
          border: oklchVar("--sidebar-border"),
          ring: oklchVar("--sidebar-ring"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "hh-rise": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "hh-fade": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "hh-rise": "hh-rise 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "hh-fade": "hh-fade 180ms ease",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
