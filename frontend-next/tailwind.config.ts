import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        mono:  ["Geist Mono", "ui-monospace", "monospace"],
        serif: ["Instrument Serif", "Georgia", "serif"],
      },
      colors: {
        ink: {
          50:  "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d1d1d6",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          950: "#09090b",
        },
        accent: {
          50:  "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          400: "#71717a",
          500: "#3f3f46",
          600: "#27272a",
          700: "#09090b",
        },
      },
      boxShadow: {
        soft:         "0 1px 3px 0 rgb(0 0 0 / .06), 0 1px 2px -1px rgb(0 0 0 / .04)",
        pop:          "0 4px 16px -2px rgb(0 0 0 / .10), 0 1px 4px -1px rgb(0 0 0 / .06)",
        "inset-line": "inset 0 1px 0 0 rgb(0 0 0 / .06)",
      },
    },
  },
  plugins: [],
};

export default config;
