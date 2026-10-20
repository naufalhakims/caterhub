import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-helpers";
import { readPrivateDocument } from "@/server/storage";

// Filesystem lokal hanya tersedia di runtime Node.
export const runtime = "nodejs";

/**
 * Menyajikan dokumen verifikasi privat.
 * Akses: ADMIN (peninjauan) atau VENDOR pemilik dokumen. Selain itu 403.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Silakan masuk.", { status: 401 });

  const doc = await db.vendorDocument.findUnique({
    where: { id: params.id },
    select: {
      fileName: true,
      storageKey: true,
      mimeType: true,
      vendor: { select: { userId: true } },
    },
  });
  if (!doc) return new NextResponse("Dokumen tidak ditemukan.", { status: 404 });

  const allowed =
    user.role === "ADMIN" || (user.role === "VENDOR" && doc.vendor.userId === user.id);
  if (!allowed) return new NextResponse("Akses ditolak.", { status: 403 });

  try {
    const buffer = await readPrivateDocument(doc.storageKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("File tidak tersedia.", { status: 404 });
  }
}
