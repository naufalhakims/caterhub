"use client";

import { Button } from "@/components/ui/Button";

/** Cetak halaman (lembar produksi untuk ditempel di dapur). */
export function PrintButton({ label = "Cetak" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="print:hidden">
      {label}
    </Button>
  );
}
