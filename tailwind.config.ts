import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        // LiLearn brand palette
        li: {
          purple: "hsl(var(--li-purple))",
          "purple-light": "hsl(var(--li-purple-light))",
          lavender: "hsl(var(--li-lavender))",
          indigo: "hsl(var(--li-indigo))",
          sky: "hsl(var(--li-sky))",
          glow: "hsl(var(--li-glow))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "calc(var(--radius) + 16px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "brand-gradient": "linear-gradient(135deg, hsl(var(--li-purple)), hsl(var(--li-indigo)), hsl(var(--li-sky)))",
        "brand-gradient-soft": "linear-gradient(135deg, hsl(var(--li-lavender)), hsl(var(--li-purple-light) / 0.5), hsl(var(--li-sky) / 0.3))",
      },
      boxShadow: {
        "brand-sm": "0 1px 3px hsl(var(--li-purple) / 0.06), 0 4px 16px hsl(var(--li-purple) / 0.08)",
        "brand": "0 4px 12px hsl(var(--li-purple) / 0.08), 0 16px 48px hsl(var(--li-purple) / 0.12)",
        "brand-lg": "0 8px 24px hsl(var(--li-purple) / 0.1), 0 24px 64px hsl(var(--li-purple) / 0.15)",
        "glow": "0 0 20px -5px hsl(var(--li-glow) / 0.2)",
        "glow-lg": "0 0 40px -10px hsl(var(--li-glow) / 0.3)",
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "float-slow": "float 8s ease-in-out infinite",
        "float-delayed": "float 7s ease-in-out 2s infinite",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "gradient-shift": "gradientShift 8s ease infinite",
        "shimmer": "shimmer 2s ease-in-out infinite",
        "reveal-up": "revealUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "reveal-left": "revealLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "reveal-right": "revealRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "spin-slow": "spin 20s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
