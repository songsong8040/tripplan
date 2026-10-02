import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * 디자인 토큰
 * - 바탕은 화이트, 포인트는 블랙 & 화이트
 * - 보조 포인트는 가벼운 파스텔(mint / sky / lilac / peach / butter / rose)
 * - 앱 느낌의 둥글둥글한 모서리 (버튼은 알약형, 카드는 24~28px)
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard Variable"', "Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
      },
      colors: {
        // 뉴트럴 (토스 계열 블루 그레이)
        ink: {
          50: "#f9fafb",
          100: "#f2f4f6",
          200: "#e5e8eb",
          300: "#d1d6db",
          400: "#b0b8c1",
          500: "#8b95a1",
          600: "#6b7684",
          700: "#4e5968",
          800: "#333d4b",
          900: "#191f28",
        },
        // 파스텔 포인트
        mint: {
          50: "#effaf5",
          100: "#dcf5e8",
          200: "#bdebd5",
          300: "#8fdbb8",
          400: "#5fc497",
          500: "#3ea97b",
          600: "#2f8a63",
          700: "#276e51",
        },
        sky: {
          50: "#eff7ff",
          100: "#ddeeff",
          200: "#c2e0ff",
          300: "#93c9fd",
          400: "#60aaf7",
          500: "#3b8cea",
          600: "#2b70c9",
          700: "#245aa1",
        },
        lilac: {
          50: "#f6f3ff",
          100: "#ede7ff",
          200: "#ddd2ff",
          300: "#c3b0fd",
          400: "#a688f8",
          500: "#8b66ee",
          600: "#7350d0",
          700: "#5d40a8",
        },
        peach: {
          50: "#fff5f0",
          100: "#ffe8dd",
          200: "#ffd0bb",
          300: "#ffad8b",
          400: "#f98a62",
          500: "#e86d45",
          600: "#c45531",
          700: "#9c4328",
        },
        butter: {
          50: "#fffbeb",
          100: "#fff4c9",
          200: "#ffea95",
          300: "#ffda5e",
          400: "#f6c434",
          500: "#dfa714",
          600: "#b5830d",
          700: "#8c650f",
        },
        rose: {
          50: "#fff1f4",
          100: "#ffe3ea",
          200: "#ffc9d7",
          300: "#ffa0b8",
          400: "#fb7096",
          500: "#ec4b78",
          600: "#cf305e",
          700: "#a8274d",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        "4xl": "1.75rem",
        "3xl": "1.5rem",
        "2xl": "1.125rem",
        xl: "calc(var(--radius) + 2px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
      },
      letterSpacing: {
        tight: "-0.025em",
        tighter: "-0.035em",
      },
      boxShadow: {
        soft: "0 1px 3px rgba(25,31,40,0.06)",
        lift: "0 8px 24px rgba(25,31,40,0.08)",
        nav: "0 -1px 0 rgba(25,31,40,0.06)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.3s ease-out both",
        float: "float 4s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
