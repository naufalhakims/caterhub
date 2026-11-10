import { NextResponse } from "next/server";
import { ApiError, apiPost } from "@/lib/api";
import { getSessionUser } from "@/lib/session";

/** BFF tipis: form HTML → REST API. Tidak ada akses database di sini. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  if (user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Hanya pelanggan yang dapat memesan." }, { status: 403 });
  }

  const form = await req.formData();
  const eventId = String(form.get("eventId") ?? "").trim();
  const vendorId = String(form.get("vendorId") ?? "");
  const packageId = String(form.get("packageId") ?? "");
  const eventDate = String(form.get("eventDate") ?? "");
  const eventTime = String(form.get("eventTime") ?? "");
  const guestCount = Number(form.get("guestCount") ?? 0);
  const location = String(form.get("location") ?? "").trim();
  const city = String(form.get("city") ?? "").trim() || "Surabaya";
  const notes = String(form.get("notes") ?? "").slice(0, 1000);
  const addOnIds = form.getAll("addOnIds").map(String).filter(Boolean).slice(0, 30);
  const lat = Number(form.get("latitude"));
  const lng = Number(form.get("longitude"));
  const pin = form.get("latitude") && Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : {};

  // Dengan acara tersimpan, tanggal/jam/pax diambil dari acara tersebut oleh API.
  if (!vendorId || !packageId || !location || (!eventId && (!eventDate || !eventTime || !guestCount))) {
    return NextResponse.json(
      { error: "Tanggal, jam, jumlah tamu, dan lokasi wajib diisi." },
      { status: 400 },
    );
  }

  try {
    const data = await apiPost<{ id: string }>("/api/v1/quotations/request", {
      ...(eventId ? { eventId } : { eventDate, eventTime, guestCount }),
      vendorId,
      packageId,
      location,
      city,
      notes: notes || undefined,
      addOnIds,
      ...pin,
    });
    return NextResponse.redirect(new URL(`/quotations/${data.id}`, req.url), 303);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Permintaan gagal dikirim.";
    const back = new URL(`/catering/${vendorId}`, req.url);
    back.searchParams.set("error", message);
    back.searchParams.set("date", eventDate);
    back.searchParams.set("time", eventTime);
    back.searchParams.set("guests", String(guestCount));
    if (eventId) back.searchParams.set("eventId", eventId);
    if ("latitude" in pin) {
      back.searchParams.set("lat", String(pin.latitude));
      back.searchParams.set("lng", String(pin.longitude));
    }
    return NextResponse.redirect(back, 303);
  }
}
