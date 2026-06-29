import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          50:  "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
          800: "#065F46",
          900: "#064E3B",
          950: "#022C22",
        },
        teal: {
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
        },
        ai: {
          bg:      "#041B1A",
          card:    "rgba(5,30,27,0.65)",
          border:  "rgba(16,185,129,0.12)",
          glow:    "rgba(16,185,129,0.15)",
        },
      },
      backgroundImage: {
        "emerald-gradient": "linear-gradient(135deg,#10B981 0%,#14B8A6 100%)",
        "emerald-gradient-hover": "linear-gradient(135deg,#34D399 0%,#2DD4BF 100%)",
      },
      animation: {
        "orb-float":   "orbFloat 12s ease-in-out infinite",
        "orb-float-r": "orbFloatR 15s ease-in-out infinite",
        "orb-slow":    "orbSlow 20s ease-in-out infinite",
        "glow-pulse":  "glowPulse 3s ease-in-out infinite",
        "fade-in":     "fadeIn 0.4s ease-out",
        "slide-up":    "slideUp 0.4s ease-out",
      },
      keyframes: {
        orbFloat: {
          "0%,100%": { transform: "translate(0,0) scale(1)",    opacity: "0.12" },
          "33%":     { transform: "translate(40px,-30px) scale(1.08)", opacity: "0.18" },
          "66%":     { transform: "translate(-25px,20px) scale(0.94)", opacity: "0.10" },
        },
        orbFloatR: {
          "0%,100%": { transform: "translate(0,0) scale(1)",    opacity: "0.10" },
          "33%":     { transform: "translate(-35px,25px) scale(0.92)", opacity: "0.15" },
          "66%":     { transform: "translate(30px,-20px) scale(1.06)", opacity: "0.08" },
        },
        orbSlow: {
          "0%,100%": { transform: "translate(0,0) scale(1)",    opacity: "0.07" },
          "50%":     { transform: "translate(20px,-40px) scale(1.12)", opacity: "0.13" },
        },
        glowPulse: {
          "0%,100%": { boxShadow: "0 0 10px rgba(16,185,129,0.2)" },
          "50%":     { boxShadow: "0 0 25px rgba(16,185,129,0.45),0 0 50px rgba(16,185,129,0.15)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;