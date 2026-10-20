import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaterHub — Temukan Catering yang Tepat untuk Acara Anda",
  description: "Cari, bandingkan, sesuaikan, dan pesan catering dalam satu platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-[#FAF7F1] text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
