import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Figtree } from "next/font/google";
import "./globals.css";

// Serif display kontras tinggi (roman + italic) untuk judul; sans humanis untuk teks.
const display = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const sans = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CaterHub · Temukan Catering yang Tepat untuk Acara Anda",
  description: "Cari, bandingkan, sesuaikan, dan pesan catering dalam satu platform.",
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-white font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
