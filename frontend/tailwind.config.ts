import type { Config } from "tailwindcss";

// Merge the `theme.extend` block below into your project's existing
// tailwind.config.ts — these are additions, not a replacement.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        console: {
          bg: "#171513", // warm charcoal, not pure black
          panel: "#221F1D",
          border: "#3A3532",
          ink: "#F2ECE1", // warm off-white, like aged knob labels
          muted: "#948C81",
        },
        signal: {
          amber: "#E8A33D", // neutral / idle indicator
          green: "#7FBF4D", // VU meter "hit" zone
          red: "#E4573D", // VU meter "clip" zone
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular"],
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(500%)" },
        },
        "rec-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
      },
      animation: {
        scan: "scan 1.1s ease-in-out infinite",
        "rec-pulse": "rec-pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
