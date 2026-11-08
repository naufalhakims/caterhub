/**
 * Smoke test end-to-end terhadap API yang sedang berjalan (default http://localhost:4000).
 *
 *   npm run test:smoke      # dari root: jalankan lalu seed ulang data demo
 *
 * Memakai akun & data seed demo, MENGUBAH data (membuat pesanan uji) — karena itu
 * skrip root menjalankan `db:seed` sesudahnya. Waktu disimulasikan untuk penjadwal
 * (masak otomatis, selesai otomatis) dengan memanggil fungsi domain langsung.
 */
import { db } from "../src/db";
import { quoteDeliveryBetween } from "../src/domain/delivery";
import { autoCompleteBookings, autoStartCooking, eventStartAt } from "../src/domain/progress";
import { jakartaDateString } from "../src/lib/date";

const API = (process.env.SMOKE_API_URL ?? "http://localhost:4000").replace(/\/+$/, "") + "/api/v1";
const jars: Record<string, string> = {};
let passed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, extra = "") {
  if (ok) passed++;
  else failures.push(label);
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`);
}

async function login(who: string, email: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "demo1234" }),
  });
  const cookie = /caterhub_session=[^;]+/.exec(res.headers.get("set-cookie") ?? "")?.[0];
  if (!cookie) throw new Error(`Login ${email} gagal (${res.status}). Sudah menjalankan db:seed?`);
  jars[who] = cookie;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(who: string | null, method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", cookie: who ? jars[who] : "" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (res.status === 204 ? {} : await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, ...json };
}

const date = (n: number) => new Date(Date.parse(`${jakartaDateString()}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const status = async (id: string) => (await db.booking.findUniqueOrThrow({ where: { id } })).status;

async function main() {
  const health = await fetch(API.replace("/api/v1", "/health")).catch(() => null);
  if (!health?.ok) throw new Error(`API tidak terjangkau di ${API}. Jalankan "npm run api:dev" lebih dulu.`);

  await login("budi", "pelanggan@demo.id");
  await login("andi", "andi@demo.id");
  await login("sari", "sari@demo.id");
  await login("vend", "vendor1@demo.id");
  await login("admin", "admin@caterhub.id");

  const vendor = await db.vendorProfile.findFirstOrThrow({ where: { user: { email: "vendor1@demo.id" } } });
  const detail = (await call(null, "GET", `/vendors/${vendor.id}`)).data;
  const pkg = detail.packages[0];
  const addOn = detail.menuItems.find((m: { price: number }) => m.price > 0);
  const near = { latitude: -7.265, longitude: 112.745 };
  const guests = pkg.minPax;

  /** Permintaan → konfirmasi vendor → booking (opsional lunas). */
  async function booking(who: string, day: number, opts: { pay?: boolean; time?: string } = {}) {
    const r = await call(who, "POST", "/quotations/request", {
      vendorId: vendor.id, packageId: pkg.id, eventDate: date(day), eventTime: opts.time ?? "11:00",
      guestCount: guests, location: `Smoke ${day}`, ...near,
    });
    if (!r.data?.id) throw new Error(`Permintaan gagal: ${JSON.stringify(r.error)}`);
    const b = (await call("vend", "POST", `/quotations/${r.data.id}/confirm`, {})).data.bookingId as string;
    if (opts.pay) {
      const p = (await call(who, "POST", "/payments", { bookingId: b })).data;
      await call(who, "POST", `/payments/${p.id}/mock-settle`);
    }
    return { quotationId: r.data.id as string, bookingId: b };
  }

  console.log("\n1. Pesan, bayar, invoice");
  {
    const { quotationId, bookingId } = await booking("budi", 70);
    const q = await db.quotation.findUniqueOrThrow({ where: { id: quotationId } });
    const expected = quoteDeliveryBetween(vendor, near);
    check("ongkir otomatis sesuai tarif", !!expected?.inRange && q.suggestedDeliveryFee === (expected as { fee: number }).fee);
    const p1 = (await call("budi", "POST", "/payments", { bookingId })).data;
    const p2 = (await call("budi", "POST", "/payments", { bookingId })).data;
    check("satu tagihan aktif per pesanan", p1.id === p2.id);
    await call("budi", "POST", `/payments/${p1.id}/mock-settle`);
    check("lunas lewat mock-settle", (await status(bookingId)) === "PAID");
    const inv = await call("budi", "GET", `/bookings/${bookingId}/invoice`);
    check("kuitansi lunas bernomor", inv.data?.paidInFull === true && /^INV\//.test(inv.data.invoiceNumber));
    check("invoice pelanggan lain ditolak", (await call("andi", "GET", `/bookings/${bookingId}/invoice`)).status === 403);
  }

  console.log("\n2. Batal, refund, batas bayar");
  {
    const a = await booking("andi", 71);
    const c = await call("andi", "POST", `/bookings/${a.bookingId}/cancel`, { reason: "Smoke batal belum bayar" });
    check("batal sebelum bayar → CANCELLED", c.data?.status === "CANCELLED");
    const b = await booking("andi", 72, { pay: true });
    await call("vend", "POST", `/bookings/${b.bookingId}/cancel`, { reason: "Smoke batal sesudah bayar" });
    check("batal sesudah lunas → REFUND_PENDING", (await status(b.bookingId)) === "REFUND_PENDING");
    await call("admin", "POST", `/admin/bookings/${b.bookingId}/refund`, { note: "Smoke" });
    check("admin tandai refund → REFUNDED", (await status(b.bookingId)) === "REFUNDED");
    const d = await booking("sari", 73);
    await db.booking.update({ where: { id: d.bookingId }, data: { paymentDueAt: new Date(Date.now() - 60_000) } });
    const late = await call("sari", "POST", "/payments", { bookingId: d.bookingId });
    check("lewat batas bayar → ditolak & batal otomatis", late.error?.code === "PAYMENT_OVERDUE" && (await status(d.bookingId)) === "CANCELLED");
  }

  console.log("\n3. Negosiasi & menu tambahan");
  {
    const r = await call("sari", "POST", "/quotations/request", {
      vendorId: vendor.id, packageId: pkg.id, eventDate: date(74), eventTime: "10:00", guestCount: guests,
      location: "Smoke nego", addOnIds: addOn ? [addOn.id] : [], ...near,
    });
    let q = (await call("vend", "GET", `/quotations/${r.data.id}`)).data;
    check("menu tambahan masuk nota", !addOn || q.items.some((i: { menuItemId: string | null }) => i.menuItemId === addOn.id));
    const items = q.items.map((i: { name: string; quantity: number; unitPrice: number; menuItemId: string | null }) => ({
      name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, ...(i.menuItemId ? { menuItemId: i.menuItemId } : {}),
    }));
    const expiresAt = new Date(Date.now() + 2 * 864e5).toISOString();
    await call("vend", "POST", "/quotations", { quotationId: q.id, eventId: q.event.id, customerId: q.customerId, items, deliveryFee: q.deliveryFee, expiresAt });
    await call("sari", "POST", `/quotations/${q.id}/decision`, { decision: "revision", revisionNote: "Smoke minta revisi" });
    q = (await call("vend", "GET", `/quotations/${q.id}`)).data;
    check("revisi diminta", q.status === "REVISION_REQUESTED");
    await call("vend", "POST", "/quotations", { quotationId: q.id, eventId: q.event.id, customerId: q.customerId, items, deliveryFee: 0, expiresAt });
    const acc = await call("sari", "POST", `/quotations/${q.id}/decision`, { decision: "accept" });
    check("terima penawaran → pesanan", !!acc.data?.bookingId && (await status(acc.data.bookingId)) === "PAYMENT_PENDING");
    const far = await call("andi", "POST", "/quotations/request", {
      vendorId: vendor.id, packageId: pkg.id, eventDate: date(75), eventTime: "10:00", guestCount: guests,
      location: "Smoke Malang", latitude: -7.9826, longitude: 112.6308,
    });
    check("di luar radius antar ditolak", far.error?.code === "OUT_OF_DELIVERY_RANGE");
  }

  console.log("\n4. Dapur, offline, progres otomatis");
  {
    const day = 76;
    const online = await booking("budi", day, { pay: true, time: "08:00" });
    const off = await call("vend", "POST", "/vendor/bookings/offline", {
      customerName: "Smoke Offline", eventName: "Smoke Offline", eventDate: date(day), eventTime: "12:00",
      guestCount: 30, location: "Smoke", packageId: pkg.id, payment: "CASH",
    });
    check("pesanan offline lunas tunai", off.status === 201 && (await status(off.data.bookingId)) === "PAID");
    const prod = (await call("vend", "GET", `/vendor/production?date=${date(day)}`)).data;
    check("lembar produksi memuat pesanan online & offline", prod.confirmed.orders.length >= 2 && prod.confirmed.summary.ingredients.length > 0);
    const costing = (await call("vend", "GET", "/vendor/costing")).data;
    check("HPP paket terhitung", costing.packages.some((p: { costing: { hpp: number } }) => p.costing.hpp > 0));

    // Simulasikan hari acara: pindahkan kedua acara ke hari ini, lalu jalankan penjadwal.
    const ids = [online.bookingId, off.data.bookingId as string];
    const events = await db.booking.findMany({ where: { id: { in: ids } }, select: { eventId: true } });
    await db.event.updateMany({
      where: { id: { in: events.map((e) => e.eventId) } },
      data: { eventDate: new Date(`${jakartaDateString()}T00:00:00Z`) },
    });
    await autoStartCooking(new Date());
    check(
      "masak otomatis di hari acara (online & offline)",
      (await status(online.bookingId)) === "PREPARING" && (await status(off.data.bookingId)) === "PREPARING",
    );
    await call("vend", "POST", `/vendor/bookings/${online.bookingId}/advance`, { to: "DELIVERED" });
    check("berangkat antar → sedang diantar", (await status(online.bookingId)) === "DELIVERED");
    await call("budi", "POST", `/bookings/${online.bookingId}/received`);
    check("pelanggan konfirmasi terima → selesai", (await status(online.bookingId)) === "COMPLETED");
    const offEv = await db.booking.findUniqueOrThrow({ where: { id: off.data.bookingId }, include: { event: true } });
    await autoCompleteBookings(new Date(eventStartAt(offEv.event.eventDate, offEv.event.eventTime).getTime() + 25 * 3600e3));
    check("offline selesai otomatis 24 jam setelah acara", (await status(off.data.bookingId)) === "COMPLETED");
  }

  console.log("\n5. Notifikasi & WhatsApp outbox");
  {
    const wa = await call("admin", "GET", "/admin/whatsapp");
    check("kotak keluar WA berisi pesan terkirim", (wa.data?.counts?.SENT ?? 0) > 0, JSON.stringify(wa.data?.counts));
    const n = await call("vend", "GET", "/me/notifications?limit=0");
    check("notifikasi vendor tersedia", typeof n.data?.unread === "number");
  }

  console.log("\n6. Keamanan sesi (akun sementara)");
  {
    const email = `smoke-${Date.now()}@demo.test`;
    const raw = async (path: string, init: RequestInit) => fetch(`${API}${path}`, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
    const sessionOf = (res: Response) => /caterhub_session=[^;]+/.exec(res.headers.get("set-cookie") ?? "")?.[0] ?? "";
    const meStatus = async (cookie: string) => (await raw("/auth/me", { headers: { cookie } })).status;
    check("sandi < 8 karakter ditolak", (await raw("/auth/register", { method: "POST", body: JSON.stringify({ name: "Smoke", email, password: "1234567" }) })).status === 400);
    await raw("/auth/register", { method: "POST", body: JSON.stringify({ name: "Smoke", email, password: "rahasia123" }) });
    const other = sessionOf(await raw("/auth/login", { method: "POST", body: JSON.stringify({ email, password: "rahasia123" }) }));
    const here = sessionOf(await raw("/auth/login", { method: "POST", body: JSON.stringify({ email, password: "rahasia123" }) }));
    const changed = await raw("/auth/password", { method: "PATCH", headers: { cookie: here }, body: JSON.stringify({ currentPassword: "rahasia123", newPassword: "rahasiaBaru99" }) });
    check("ganti sandi mencabut sesi lain, sesi ini diperbarui", (await meStatus(other)) === 401 && (await meStatus(sessionOf(changed))) === 200);
    await db.user.deleteMany({ where: { email } });
  }

  console.log(`\n${failures.length === 0 ? "SEMUA LULUS" : "ADA YANG GAGAL"}: ${passed} lulus, ${failures.length} gagal`);
  if (failures.length) {
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(`\nSmoke test berhenti: ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
