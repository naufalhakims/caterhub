/** @type {import('next').NextConfig} */
const nextConfig = {
  // Default .next. Bisa diarahkan agar build verifikasi tidak bentrok dengan
  // `next dev` yang sedang berjalan (mis. NEXT_DIST_DIR=.next-build-check).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
