"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Menyegarkan data server secara berkala agar pesan baru muncul tanpa reload.
 * Hanya berjalan saat tab terlihat untuk menghindari query sia-sia.
 */
export function AutoRefresh({ intervalMs = 12000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
