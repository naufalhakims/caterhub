import { NextResponse } from "next/server";
import { ApiError, apiPost } from "@/lib/api";
import { getSessionUser } from "@/lib/session";

/** BFF tipis: form HTML → REST API. Tidak ada akses database di sini. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  if (user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Hanya pelanggan yang dapat meminta penawaran." }, { status: 403 });
  }

  const form = await req.formData();
  const eventId = String(form.get("eventId") ?? "");
  const packageId = String(form.get("packageId") ?? "");
  const vendorId = String(form.get("vendorId") ?? "");
  const notes = String(form.get("notes") ?? "").slice(0, 1000);

  if (!eventId || !packageId || !vendorId) {
    return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });
  }

  try {
    const data = await apiPost<{ id: string }>("/api/v1/quotations/request", {
      eventId,
      packageId,
      vendorId,
      notes,
    });
    return NextResponse.redirect(new URL(`/quotations/${data.id}`, req.url), 303);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Permintaan gagal dikirim.";
    return NextResponse.json({ error: message }, { status });
  }
}
