import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-helpers";

/**
 * Permintaan pesanan dari pelanggan (bukan penawaran vendor).
 * Hasilnya Quotation dengan origin CUSTOMER_REQUEST dan status REQUESTED —
 * vendor harus memutuskan lebih dulu (kirim penawaran atau tolak).
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }
  // Permintaan penawaran hanya untuk pelanggan — vendor/admin tidak boleh memesan.
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
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || event.customerId !== user.id) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }
  const vendor = await db.vendorProfile.findUnique({ where: { id: vendorId } });
  if (!vendor || vendor.verificationStatus !== "VERIFIED") {
    return NextResponse.json({ error: "Vendor belum terverifikasi." }, { status: 400 });
  }
  if (vendor.userId === user.id) {
    return NextResponse.json({ error: "Vendor tidak dapat memesan catering sendiri." }, { status: 400 });
  }
  const pkg = await db.package.findUnique({ where: { id: packageId } });
  if (!pkg || pkg.vendorId !== vendorId || !pkg.isActive) {
    return NextResponse.json({ error: "Paket tidak valid." }, { status: 400 });
  }
  if (event.guestCount < pkg.minPax || event.guestCount > pkg.maxPax) {
    return NextResponse.json(
      { error: `Jumlah tamu di luar rentang paket (${pkg.minPax}–${pkg.maxPax} pax).` },
      { status: 400 },
    );
  }

  // Hindari duplikat: satu permintaan aktif per acara + vendor.
  const existing = await db.quotation.findFirst({
    where: {
      eventId,
      vendorId,
      customerId: user.id,
      origin: "CUSTOMER_REQUEST",
      status: { in: ["REQUESTED", "SENT", "REVISION_REQUESTED"] },
    },
  });
  if (existing) {
    return NextResponse.redirect(new URL(`/quotations/${existing.id}`, req.url), 303);
  }

  const estimate = pkg.pricePerPax * event.guestCount;
  const quotation = await db.quotation.create({
    data: {
      eventId,
      packageId,
      vendorId,
      customerId: user.id,
      origin: "CUSTOMER_REQUEST",
      status: "REQUESTED",
      subtotal: estimate,
      total: estimate,
      notes,
      items: {
        create: [
          {
            name: `Paket ${pkg.name} (${event.guestCount} pax)`,
            quantity: event.guestCount,
            unitPrice: pkg.pricePerPax,
            subtotal: estimate,
          },
        ],
      },
      history: {
        create: {
          actorId: user.id,
          action: "created",
          toStatus: "REQUESTED",
          note: `Permintaan pesanan dari pelanggan untuk "${event.name}".`,
        },
      },
    },
  });
  await db.notification.create({
    data: {
      userId: vendor.userId,
      type: "ORDER_REQUEST",
      title: "Permintaan pesanan baru",
      message: `Acara "${event.name}" (${event.guestCount} pax) meminta penawaran paket ${pkg.name}.`,
    },
  });
  return NextResponse.redirect(new URL(`/quotations/${quotation.id}`, req.url), 303);
}
