import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        leaf: {
          50: "#f6fee7",
          100: "#e9fccc",
          300: "#b9f26d",
          500: "#7fd321",
          600: "#62aa16",
          900: "#244509"
        },
        ink: "#172014"
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "Apple SD Gothic Neo",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Arial",
          "sans-serif"
        ],
        story: ["MaruBuri", "NanumMyeongjo", "KoPubBatang", "serif"],
        batang: ["KoPubBatang", "NanumMyeongjo", "serif"],
        title: ["Sumunjang_TitleM", "Pretendard", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
