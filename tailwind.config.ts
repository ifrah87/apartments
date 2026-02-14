// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-0": "rgb(var(--bg-0) / <alpha-value>)",
        "bg-1": "rgb(var(--bg-1) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        "panel-2": "rgb(var(--panel-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-strong": "rgb(var(--accent-strong) / <alpha-value>)",
        ink: "rgb(var(--bg-0) / <alpha-value>)",
        surface: "rgb(var(--panel) / <alpha-value>)",
        "surface-2": "rgb(var(--panel-2) / <alpha-value>)",
        subtle: "rgb(var(--color-subtle) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
      },
      boxShadow: {
        "card-soft": "0 18px 40px rgba(2, 6, 23, 0.35)",
        "card-glow": "0 0 0 1px rgba(56, 189, 248, 0.12), 0 18px 40px rgba(2, 6, 23, 0.35)",
      },
    },
  },
  plugins: [],
} satisfies Config;
