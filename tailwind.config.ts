import type { Config } from "tailwindcss";

/**
 * Brand ramp derived from the two supplied colours:
 *   brand-500 = #0084FF (primary blue)
 *   brand-400 = #00C6FF (light blue)
 * `<alpha-value>` keeps the `/30`-style opacity modifiers working on these
 * custom colours, which plain hex values would silently drop.
 */
const brand = {
  50: "rgb(240 247 255 / <alpha-value>)",
  100: "rgb(220 238 255 / <alpha-value>)",
  200: "rgb(170 219 255 / <alpha-value>)",
  300: "rgb(85 198 255 / <alpha-value>)",
  400: "rgb(0 198 255 / <alpha-value>)",
  500: "rgb(0 132 255 / <alpha-value>)",
  600: "rgb(0 104 204 / <alpha-value>)",
  700: "rgb(0 82 163 / <alpha-value>)",
  800: "rgb(0 61 122 / <alpha-value>)",
  900: "rgb(0 41 82 / <alpha-value>)",
  950: "rgb(0 22 49 / <alpha-value>)",
} as const;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand,
      },
    },
  },
  plugins: [],
};

export default config;
