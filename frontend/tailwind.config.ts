import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FDF6EE",
          100: "#FAEAD7",
          200: "#F5D5B3",
          300: "#EDB988",
          500: "#D96C2B",
          600: "#C2410C",
          700: "#9A3412",
          800: "#7C2D12",
          900: "#5F240E",
        },
      },
      fontFamily: {
        display: ["Georgia", '"Times New Roman"', "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28,25,23,.05), 0 8px 24px -12px rgba(28,25,23,.18)",
        lift: "0 2px 4px rgba(28,25,23,.06), 0 16px 40px -16px rgba(154,52,18,.28)",
      },
    },
  },
  plugins: [],
};

export default config;
