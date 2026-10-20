import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Menyajikan dokumen verifikasi privat dari API.
 * Otorisasi (ADMIN atau VENDOR pemilik) ditegakkan di backend; route ini hanya
 * meneruskan cookie sesi dan meneruskan respons.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/v1/documents/${params.id}`, {
      headers: {
        cookie: req.headers.get("cookie") ?? "",
        accept: "*/*",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const message = await res.text();
      return new NextResponse(message || "Dokumen tidak tersedia.", { status: res.status });
    }
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition": res.headers.get("content-disposition") ?? "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Layanan dokumen tidak tersedia.", { status: 502 });
  }
}
