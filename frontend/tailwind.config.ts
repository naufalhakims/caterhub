import type { Config } from "tailwindcss";

/**
 * Bahasa visual: halaman putih bersih, serif display kontras tinggi dengan kata
 * miring berwarna, sans humanis untuk teks, CTA pil kuning cerah, aksen hijau
 * zaitun, panel gradien buah (mint→kuning, peach→pink), footer cokelat tua.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Hijau zaitun — aksen utama (tautan, status aktif, kata miring default).
        brand: {
          50: "#F4F6EC",
          100: "#E8EDD5",
          200: "#D3DCB1",
          300: "#B5C384",
          500: "#6E7D36",
          600: "#58662A",
          700: "#46521F",
          800: "#384119",
          900: "#2A3113",
        },
        // Kuning cerah — tombol aksi utama & bar harga.
        sun: {
          100: "#FFFBD1",
          200: "#FFF69C",
          300: "#FFF06A",
          400: "#FBE734",
          500: "#EDD514",
        },
        ink: "#1D1B16",
        paper: "#F7F6F1",
        tangerine: "#EE5A1F",
        berry: "#C8215E",
        maroon: "#7A2B24",
        blush: "#FDE6EF",
        mint: "#DCEFCB",
        peach: "#FDDCC0",
        cocoa: {
          DEFAULT: "#33231A",
          800: "#3D2B21",
          700: "#4C372B",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", '"Times New Roman"', "serif"],
      },
      transitionTimingFunction: {
        // Setara spring critically damped (tanpa overshoot) — default untuk UI.
        fluid: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(29,27,22,.04)",
        lift: "0 2px 6px rgba(29,27,22,.05), 0 18px 40px -20px rgba(29,27,22,.25)",
      },
    },
  },
  plugins: [],
};

export default config;
