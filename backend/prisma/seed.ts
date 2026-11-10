/**
 * Seed demo CaterHub — data yang "bercerita" untuk presentasi.
 *
 * Aman dijalankan berulang: data transaksi milik akun demo (@demo.id, admin,
 * placeholder offline) di-RESET lalu dibuat ulang relatif terhadap hari ini.
 * Katalog (menu, paket, gambar) yang sudah ada dipertahankan; yang belum ada
 * ditambahkan. Akun non-demo tidak disentuh, KECUALI pesanannya ke vendor demo.
 *
 * Cerita utama ada di vendor "Dapur Nusantara" (vendor1@demo.id) — lihat
 * docs/DEMO_SCRIPT.md untuk alur presentasi.
 */
import { PrismaClient, type BookingStatus, type QuotationOrigin, type QuotationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { formatWhatsAppMessage, normalizeIndonesianPhone } from "../src/domain/whatsapp";
import { formatInvoiceNumber, vendorInvoicePrefix } from "../src/domain/invoice";
import { computePaymentDueAt } from "../src/domain/booking";
import { quoteDeliveryBetween } from "../src/domain/delivery";
import { jakartaDateString } from "../src/lib/date";

const db = new PrismaClient();
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
  console.error("[seed] Menolak berjalan di production (set ALLOW_DEMO_SEED=true bila memang disengaja).");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Katalog
// ---------------------------------------------------------------------------

const MENUS: Record<string, { name: string; price: number; desc: string }[]> = {
  Nasi: [
    { name: "Nasi putih hangat", price: 0, desc: "Beras premium pulen, dimasak dadakan." },
    { name: "Nasi kuning gurih", price: 3000, desc: "Santan + kunyit, wangi pandan." },
    { name: "Nasi liwet Solo", price: 4000, desc: "Gurih santan dengan areh." },
  ],
  Lauk: [
    { name: "Ayam bakar madu", price: 0, desc: "Ayam kampung, olesan madu bakar." },
    { name: "Beef teriyaki", price: 8000, desc: "Sapi iris saus teriyaki Jepang." },
    { name: "Rendang sapi empuk", price: 9000, desc: "Masak 6 jam, bumbu meresap." },
    { name: "Ikan asam manis", price: 5000, desc: "Gurame fillet saus segar." },
    { name: "Udang saus Padang", price: 9000, desc: "Udang windu bumbu pedas gurih." },
  ],
  Sayur: [
    { name: "Capcay kuah", price: 0, desc: "Sayur segar pasar pagi." },
    { name: "Sop kimlo hangat", price: 0, desc: "Kuah bening, cocok hajatan." },
    { name: "Tumis buncis bawang putih", price: 0, desc: "Renyah, tidak lembek." },
  ],
  Dessert: [
    { name: "Pudding cokelat vla", price: 0, desc: "Lembut, tidak terlalu manis." },
    { name: "Buah potong segar", price: 2000, desc: "Melon, semangka, nanas." },
    { name: "Es campur / es teler", price: 5000, desc: "Favorit acara siang." },
  ],
  Minuman: [
    { name: "Es teh manis", price: 0, desc: "Teh melati diseduh pekat." },
    { name: "Jeruk peras hangat", price: 3000, desc: "Jeruk peras asli." },
    { name: "Kopi tubruk + teh", price: 4000, desc: "Corner kopi acara." },
  ],
  Snack: [
    { name: "Lemper ayam", price: 2500, desc: "Ketan lembut isi ayam." },
    { name: "Risoles mayo", price: 3000, desc: "Renyah, isi smoked beef." },
    { name: "Pastel ayam", price: 2500, desc: "Kulit tipis renyah." },
  ],
};

/** Bahan baku Dapur Nusantara (harga pasar Surabaya, per satuan beli). */
const INGREDIENTS: [string, "kg" | "liter" | "pcs", number][] = [
  ["Beras", "kg", 14000],
  ["Daging ayam", "kg", 38000],
  ["Daging sapi", "kg", 130000],
  ["Udang windu", "kg", 110000],
  ["Ikan gurame", "kg", 55000],
  ["Telur", "pcs", 2000],
  ["Minyak goreng", "liter", 18000],
  ["Santan", "liter", 24000],
  ["Gula pasir", "kg", 17000],
  ["Bumbu dasar", "kg", 60000],
  ["Sayur campur", "kg", 15000],
  ["Buah segar", "kg", 12000],
  ["Teh celup", "pcs", 300],
  ["Kopi bubuk", "kg", 90000],
  ["Jeruk peras", "kg", 20000],
  ["Tepung terigu", "kg", 12000],
  ["Ketan", "kg", 18000],
  ["Susu & cokelat", "liter", 30000],
];

/** Resep per porsi (gram / ml / pcs). */
const RECIPES: Record<string, [string, number][]> = {
  "Nasi putih hangat": [["Beras", 100]],
  "Nasi kuning gurih": [["Beras", 100], ["Santan", 20], ["Bumbu dasar", 5]],
  "Nasi liwet Solo": [["Beras", 100], ["Santan", 25], ["Bumbu dasar", 5]],
  "Ayam bakar madu": [["Daging ayam", 150], ["Gula pasir", 5], ["Bumbu dasar", 10], ["Minyak goreng", 10]],
  "Beef teriyaki": [["Daging sapi", 50], ["Gula pasir", 5], ["Bumbu dasar", 8], ["Minyak goreng", 5]],
  "Rendang sapi empuk": [["Daging sapi", 60], ["Santan", 40], ["Bumbu dasar", 15]],
  "Ikan asam manis": [["Ikan gurame", 120], ["Gula pasir", 8], ["Tepung terigu", 10], ["Minyak goreng", 15]],
  "Udang saus Padang": [["Udang windu", 80], ["Bumbu dasar", 12], ["Minyak goreng", 8]],
  "Capcay kuah": [["Sayur campur", 100], ["Bumbu dasar", 3], ["Minyak goreng", 5]],
  "Sop kimlo hangat": [["Sayur campur", 80], ["Daging ayam", 20], ["Bumbu dasar", 3]],
  "Tumis buncis bawang putih": [["Sayur campur", 90], ["Bumbu dasar", 3], ["Minyak goreng", 5]],
  "Pudding cokelat vla": [["Susu & cokelat", 80], ["Gula pasir", 10]],
  "Buah potong segar": [["Buah segar", 120]],
  "Es campur / es teler": [["Buah segar", 60], ["Gula pasir", 15], ["Susu & cokelat", 30]],
  "Es teh manis": [["Teh celup", 1], ["Gula pasir", 15]],
  "Jeruk peras hangat": [["Jeruk peras", 150], ["Gula pasir", 10]],
  "Kopi tubruk + teh": [["Kopi bubuk", 10], ["Teh celup", 1], ["Gula pasir", 10]],
  "Lemper ayam": [["Ketan", 40], ["Daging ayam", 20], ["Santan", 10]],
  "Risoles mayo": [["Tepung terigu", 30], ["Telur", 0.3], ["Minyak goreng", 15], ["Daging sapi", 10]],
  "Pastel ayam": [["Tepung terigu", 30], ["Daging ayam", 15], ["Minyak goreng", 15]],
};

type VendorSeed = {
  businessName: string;
  city: string;
  phone: string;
  address: string;
  desc: string;
  rating: number;
  reviews: number;
  basePrice: number;
  minPax: number;
  maxPax: number;
  /** Perkiraan titik dapur (alamat di atas) & tarif ongkir. */
  lat: number;
  lng: number;
  rate: [baseFee: number, baseKm: number, perKm: number, maxKm: number];
};

const VENDORS: VendorSeed[] = [
  {
    businessName: "Dapur Nusantara", city: "Surabaya", phone: "0811-1111-111", address: "Jl. Raya Nginden No. 12, Surabaya",
    desc: "Spesialis prasmanan Jawa-Timuran untuk pernikahan & korporat. Dapur 500 pax/hari, tim pramusaji berseragam, dan stall live-cooking.",
    rating: 4.8, reviews: 214, basePrice: 35000, minPax: 50, maxPax: 600, lat: -7.2999, lng: 112.7684, rate: [15000, 3, 4000, 25],
  },
  {
    businessName: "Rasa Prima Catering", city: "Surabaya", phone: "0812-2222-222", address: "Jl. Manyar Kertoarjo V No. 8, Surabaya",
    desc: "Catering modern dengan sentuhan internasional — teriyaki, pasta corner, dan dessert premium. Favorit gathering kantor.",
    rating: 4.6, reviews: 167, basePrice: 32000, minPax: 50, maxPax: 500, lat: -7.2793, lng: 112.7621, rate: [20000, 5, 3500, 20],
  },
  {
    businessName: "Sajian Kita", city: "Sidoarjo", phone: "0813-3333-333", address: "Jl. Pahlawan No. 45, Sidoarjo",
    desc: "Harga bersahabat untuk hajatan kampung, arisan, dan nasi kotak harian. Bisa dadakan H-3 untuk di bawah 200 pax.",
    rating: 4.5, reviews: 189, basePrice: 28000, minPax: 30, maxPax: 400, lat: -7.4479, lng: 112.7186, rate: [10000, 3, 3000, 20],
  },
  {
    businessName: "Pawon Ibu", city: "Gresik", phone: "0814-4444-444", address: "Jl. Veteran No. 21, Gresik",
    desc: "Masakan rumahan resep keluarga — liwet, botok, dan sayur lodeh yang bikin tamu nambah. Spesialis tasyakuran & aqiqah.",
    rating: 4.4, reviews: 132, basePrice: 25000, minPax: 30, maxPax: 350, lat: -7.1660, lng: 112.6530, rate: [12000, 4, 3000, 30],
  },
  {
    businessName: "Kitchen 88", city: "Surabaya", phone: "0815-5555-555", address: "Jl. HR Muhammad No. 88, Surabaya",
    desc: "Segmen premium: bahan pilihan, plating cantik, dan coffee break corner. Langganan seminar hotel & wedding gedung.",
    rating: 4.7, reviews: 98, basePrice: 40000, minPax: 50, maxPax: 500, lat: -7.2885, lng: 112.6830, rate: [25000, 5, 5000, 30],
  },
];

const CUSTOMERS = [
  { key: "budi", name: "Budi Santoso", email: "pelanggan@demo.id", phone: "0812-3131-3131", address: "Jl. Ketintang Baru 7", city: "Surabaya" },
  { key: "sari", name: "Sari Wijaya", email: "sari@demo.id", phone: "0813-5050-2020", address: "Perum Graha Famili B-12", city: "Surabaya" },
  { key: "andi", name: "Andi Pratama", email: "andi@demo.id", phone: "0857-4400-1188", address: "Pondok Mutiara Blok C3", city: "Sidoarjo" },
  { key: "kantor", name: "PT Maju Jaya", email: "kantor@demo.id", phone: "0822-7000-1234", address: "Rungkut Industri III/18", city: "Surabaya" },
] as const;
type CustomerKey = (typeof CUSTOMERS)[number]["key"];

const REVIEW_TEXTS: [number, string][] = [
  [5, "Rasanya konsisten enak dari akad sampai resepsi. Tamu sampai nambah dua kali!"],
  [5, "Pramusajinya sigap, stall sate-nya nggak pernah sepi. Recommended."],
  [4, "Enak dan tepat waktu. Porsinya pas untuk 200 tamu, masih sisa sedikit."],
  [5, "Sudah 3x pakai untuk acara kantor, nggak pernah kecewa. Admin fast respon."],
  [4, "Dessert-nya juara. Sayur sedikit kurang hangat pas jam makan, tapi overall puas."],
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Tanggal date-only (UTC tengah malam) N hari dari hari ini (WIB). */
function day(n: number): Date {
  const today = new Date(`${jakartaDateString()}T00:00:00.000Z`);
  return new Date(today.getTime() + n * 86_400_000);
}
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000);

let reviewSeq = 0;
const invoiceSeq = new Map<string, number>();
function nextInvoice(vendor: { id: string; businessName: string }, at: Date) {
  const year = Number(jakartaDateString(at).slice(0, 4));
  const key = `${vendor.id}:${year}`;
  const n = (invoiceSeq.get(key) ?? 0) + 1;
  invoiceSeq.set(key, n);
  return formatInvoiceNumber(vendorInvoicePrefix(vendor.businessName), year, n);
}

async function addNotification(
  userId: string,
  n: { type: string; title: string; message: string; link: string; whatsapp?: boolean; at?: Date; read?: boolean },
) {
  const createdAt = n.at ?? new Date();
  await db.notification.create({
    data: { userId, type: n.type, title: n.title, message: n.message, link: n.link, createdAt, readAt: n.read ? createdAt : null },
  });
  if (!n.whatsapp) return;
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, phone: true, vendorProfile: { select: { phone: true } } } });
  const phone = normalizeIndonesianPhone(u.role === "VENDOR" ? u.vendorProfile?.phone || u.phone : u.phone);
  await db.whatsAppMessage.create({
    data: {
      userId,
      toPhone: phone,
      event: n.type,
      body: formatWhatsAppMessage({ title: n.title, message: n.message, link: n.link, appUrl: APP_URL }),
      status: phone ? "SENT" : "SKIPPED",
      provider: "mock",
      providerMessageId: phone ? `MOCK-SEED${Math.random().toString(16).slice(2, 10).toUpperCase()}` : null,
      error: phone ? null : "Nomor WhatsApp belum diisi di profil.",
      attempts: phone ? 1 : 0,
      sentAt: phone ? createdAt : null,
      createdAt,
    },
  });
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

async function resetDemoData(vendorIds: string[], userIds: string[]) {
  const placeholders = await db.user.findMany({
    where: { isPlaceholder: true, email: { in: vendorIds.map((id) => `offline+${id}@caterhub.local`) } },
    select: { id: true },
  });
  const customerIds = [...userIds, ...placeholders.map((p) => p.id)];
  const bookingWhere = { OR: [{ vendorId: { in: vendorIds } }, { customerId: { in: customerIds } }] };

  await db.whatsAppMessage.deleteMany({ where: { userId: { in: customerIds } } });
  await db.notification.deleteMany({ where: { userId: { in: customerIds } } });
  await db.review.deleteMany({ where: { OR: [{ vendorId: { in: vendorIds } }, { customerId: { in: customerIds } }] } });
  await db.payment.deleteMany({ where: { booking: bookingWhere } });
  await db.booking.deleteMany({ where: bookingWhere });
  await db.quotation.deleteMany({ where: { OR: [{ vendorId: { in: vendorIds } }, { customerId: { in: customerIds } }] } });
  await db.event.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.availability.deleteMany({ where: { vendorId: { in: vendorIds } } });
  await db.invoiceCounter.deleteMany({ where: { vendorId: { in: vendorIds } } });
  await db.user.deleteMany({ where: { id: { in: placeholders.map((p) => p.id) } } });
}

// ---------------------------------------------------------------------------
// Pembuat pesanan
// ---------------------------------------------------------------------------

type Ctx = {
  vendors: { id: string; userId: string; businessName: string; maxPax: number; lat: number; lng: number; rate: VendorSeed["rate"]; packages: Record<string, { id: string; name: string; pricePerPax: number }>; menus: Map<string, { id: string; price: number }> }[];
  customers: Record<CustomerKey, { id: string; name: string }>;
};

type OrderSpec = {
  vendorIdx: number;
  customer: CustomerKey | { offlineName: string; offlinePhone?: string };
  event: { name: string; type?: "WEDDING" | "BIRTHDAY" | "CORPORATE" | "MEETING" | "GATHERING" | "OTHER"; dayOffset: number; time: string; guests: number; location: string; city?: string; at?: [number, number] };
  pkg: "hemat" | "premium";
  addOns?: string[];
  extraItems?: { name: string; quantity: number; unitPrice: number }[];
  fees?: { deliveryFee?: number; serviceFee?: number; discount?: number };
  origin: QuotationOrigin;
  quotationStatus: QuotationStatus;
  notes?: string;
  revisionNote?: string;
  expiresInHours?: number;
  createdDaysAgo: number;
  booking?: {
    status: BookingStatus;
    paid?: boolean;
    method?: "QRIS" | "CASH" | "TRANSFER";
    paymentDueInHours?: number;
    /** Sudah berangkat antar N jam lalu (status DELIVERED). */
    departedHoursAgo?: number;
    cancel?: { by: "CUSTOMER" | "VENDOR"; reason: string };
    review?: number;
  };
  history?: { action: string; to: QuotationStatus; note: string; actor: "customer" | "vendor"; hoursAgo: number }[];
};

async function createOrder(ctx: Ctx, s: OrderSpec) {
  const vendor = ctx.vendors[s.vendorIdx];
  const offline = typeof s.customer !== "string";
  let customerId: string;
  if (typeof s.customer === "string") customerId = ctx.customers[s.customer].id;
  else {
    const ph = await db.user.upsert({
      where: { email: `offline+${vendor.id}@caterhub.local` },
      update: {},
      create: { email: `offline+${vendor.id}@caterhub.local`, name: `Pelanggan offline · ${vendor.businessName}`, role: "CUSTOMER", isPlaceholder: true, whatsappOptIn: false },
    });
    customerId = ph.id;
  }
  const createdAt = new Date(Date.now() - s.createdDaysAgo * 86_400_000);
  const pkg = vendor.packages[s.pkg];
  const guests = s.event.guests;
  const items = [
    { name: `Paket ${pkg.name} (${guests} pax)`, quantity: guests, unitPrice: pkg.pricePerPax, menuItemId: null as string | null },
    ...(s.addOns ?? []).flatMap((n) => {
      const m = vendor.menus.get(n);
      return m ? [{ name: `Tambahan: ${n}`, quantity: guests, unitPrice: m.price, menuItemId: m.id }] : [];
    }),
    ...(s.extraItems ?? []).map((i) => ({ ...i, menuItemId: null })),
  ];
  const subtotal = items.reduce((t, i) => t + i.quantity * i.unitPrice, 0);
  const delivery = s.event.at
    ? quoteDeliveryBetween(
        { latitude: vendor.lat, longitude: vendor.lng, deliveryBaseFee: vendor.rate[0], deliveryBaseKm: vendor.rate[1], deliveryPerKm: vendor.rate[2], deliveryMaxKm: vendor.rate[3] },
        { latitude: s.event.at[0], longitude: s.event.at[1] },
      )
    : null;
  const suggestedFee = delivery?.inRange ? delivery.fee : null;
  // Tanpa ongkir eksplisit, pakai tarif (seperti permintaan sungguhan).
  const deliveryFee = s.fees?.deliveryFee ?? suggestedFee ?? 0;
  const serviceFee = s.fees?.serviceFee ?? 0;
  const discount = s.fees?.discount ?? 0;
  const total = Math.max(0, subtotal + deliveryFee + serviceFee - discount);
  const eventDate = day(s.event.dayOffset);

  const event = await db.event.create({
    data: {
      customerId, name: s.event.name, eventType: s.event.type ?? "OTHER", eventDate, eventTime: s.event.time,
      location: s.event.location, city: s.event.city ?? "Surabaya", guestCount: guests, notes: s.notes, createdAt,
      latitude: s.event.at?.[0] ?? null, longitude: s.event.at?.[1] ?? null,
    },
  });
  const quotation = await db.quotation.create({
    data: {
      eventId: event.id, packageId: pkg.id, vendorId: vendor.id, customerId, origin: s.origin, status: s.quotationStatus,
      subtotal, deliveryFee, serviceFee, discount, total, notes: s.notes, revisionNote: s.revisionNote ?? null,
      expiresAt: s.expiresInHours ? hoursFromNow(s.expiresInHours) : null, createdAt,
      distanceKm: delivery?.distanceKm ?? null, suggestedDeliveryFee: suggestedFee,
      items: { create: items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.quantity * i.unitPrice, menuItemId: i.menuItemId })) },
      history: {
        create: [
          {
            actorId: offline ? vendor.userId : customerId, action: "created", toStatus: s.origin === "VENDOR_OFFLINE" ? "ACCEPTED" : "REQUESTED",
            note: offline ? `Pesanan offline dicatat vendor untuk ${(s.customer as { offlineName: string }).offlineName}.` : `Permintaan pesanan dari pelanggan untuk "${s.event.name}".`,
            createdAt,
          },
          ...(s.history ?? []).map((h) => ({
            actorId: h.actor === "vendor" ? vendor.userId : customerId, action: h.action, toStatus: h.to, note: h.note,
            createdAt: new Date(Date.now() - h.hoursAgo * 3_600_000),
          })),
        ],
      },
    },
  });
  if (!s.booking) return { quotation, event, vendor, booking: null };

  const b = s.booking;
  const confirmedAt = new Date(createdAt.getTime() + 3 * 3_600_000);
  const refund = b.cancel && b.paid && !offline;
  const booking = await db.booking.create({
    data: {
      eventId: event.id, quotationId: quotation.id, vendorId: vendor.id, customerId, status: b.status,
      totalAmount: total, depositAmount: total, remainingAmount: 0, confirmedAt, createdAt: confirmedAt,
      paymentDueAt: offline ? null : b.paymentDueInHours ? hoursFromNow(b.paymentDueInHours) : computePaymentDueAt(confirmedAt, eventDate),
      invoiceNumber: nextInvoice(vendor, confirmedAt),
      source: offline ? "OFFLINE" : "ONLINE",
      offlineCustomerName: offline ? (s.customer as { offlineName: string }).offlineName : null,
      offlineCustomerPhone: offline ? ((s.customer as { offlinePhone?: string }).offlinePhone ?? null) : null,
      cancelledAt: b.cancel ? hoursFromNow(-6) : null,
      cancelReason: b.cancel?.reason ?? null,
      cancelledBy: b.cancel?.by ?? null,
      refundAmount: refund ? total : null,
      departedAt: b.departedHoursAgo != null ? hoursFromNow(-b.departedHoursAgo) : null,
    },
  });
  if (b.paid) {
    const paidAt = new Date(confirmedAt.getTime() + 5 * 3_600_000);
    await db.payment.create({
      data: {
        bookingId: booking.id, provider: offline ? "manual" : "mock",
        providerReference: `SEED-${booking.id.slice(-10).toUpperCase()}`, amount: total,
        method: b.method ?? (offline ? "CASH" : "QRIS"), status: "SETTLEMENT", paidAt,
        qrPayload: offline ? null : `MOCK-QRIS:${booking.id}:${total}`,
      },
    });
  }
  if (b.review && !offline) {
    // Bergiliran agar ulasan di halaman vendor tidak berulang.
    const text = REVIEW_TEXTS[reviewSeq++ % REVIEW_TEXTS.length];
    await db.review.create({ data: { bookingId: booking.id, customerId, vendorId: vendor.id, rating: b.review, comment: text[1], createdAt: hoursFromNow(-20) } });
  }
  return { quotation, event, vendor, booking };
}

/** Hitung ulang kapasitas terpakai dari pesanan yang masih aktif. */
async function rebuildAvailability(vendorIds: string[]) {
  const active = await db.booking.findMany({
    where: { vendorId: { in: vendorIds }, status: { notIn: ["CANCELLED", "REFUND_PENDING", "REFUNDED"] } },
    select: { vendorId: true, vendor: { select: { maxPax: true } }, event: { select: { eventDate: true, guestCount: true } } },
  });
  const sums = new Map<string, { vendorId: string; date: Date; pax: number; max: number }>();
  for (const b of active) {
    const key = `${b.vendorId}:${b.event.eventDate.toISOString()}`;
    const row = sums.get(key) ?? { vendorId: b.vendorId, date: b.event.eventDate, pax: 0, max: b.vendor.maxPax };
    row.pax += b.event.guestCount;
    sums.set(key, row);
  }
  for (const r of sums.values()) {
    await db.availability.create({ data: { vendorId: r.vendorId, date: r.date, maxPax: Math.max(r.max, r.pax), reservedPax: r.pax } });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const admin = await db.user.upsert({
    where: { email: "admin@caterhub.id" },
    update: {},
    create: { name: "Admin CaterHub", email: "admin@caterhub.id", passwordHash, role: "ADMIN" },
  });

  const customers = {} as Ctx["customers"];
  for (const c of CUSTOMERS) {
    const u = await db.user.upsert({
      where: { email: c.email },
      update: { name: c.name, phone: c.phone, address: c.address, city: c.city, whatsappOptIn: true },
      create: { name: c.name, email: c.email, passwordHash, role: "CUSTOMER", phone: c.phone, address: c.address, city: c.city },
    });
    customers[c.key] = { id: u.id, name: c.name };
  }

  // Vendor + katalog (dipertahankan bila sudah ada)
  const vendors: Ctx["vendors"] = [];
  let vi = 0;
  for (const seed of VENDORS) {
    vi++;
    // Vendor demo utama memakai nomor WA sungguhan (env) agar notifikasi Fonnte sampai ke HP.
    const demoPhone = process.env.DEMO_VENDOR_WHATSAPP?.trim();
    const v = vi === 1 && demoPhone ? { ...seed, phone: demoPhone } : seed;
    const email = `vendor${vi}@demo.id`;
    const user = await db.user.upsert({
      where: { email },
      update: { whatsappOptIn: true },
      create: { name: v.businessName, email, passwordHash, role: "VENDOR" },
    });
    const profile = await db.vendorProfile.upsert({
      where: { userId: user.id },
      update: {
        businessName: v.businessName, city: v.city, phone: v.phone, address: v.address, description: v.desc,
        verificationStatus: "VERIFIED", rating: v.rating, reviewCount: v.reviews, minPax: v.minPax, maxPax: v.maxPax,
        latitude: v.lat, longitude: v.lng,
        deliveryBaseFee: v.rate[0], deliveryBaseKm: v.rate[1], deliveryPerKm: v.rate[2], deliveryMaxKm: v.rate[3],
      },
      create: {
        userId: user.id, businessName: v.businessName, city: v.city, phone: v.phone, address: v.address, description: v.desc,
        verificationStatus: "VERIFIED", rating: v.rating, reviewCount: v.reviews, minPax: v.minPax, maxPax: v.maxPax,
        latitude: v.lat, longitude: v.lng,
        deliveryBaseFee: v.rate[0], deliveryBaseKm: v.rate[1], deliveryPerKm: v.rate[2], deliveryMaxKm: v.rate[3],
      },
    });
    for (const [cat, list] of Object.entries(MENUS)) {
      for (const m of list) {
        const exists = await db.menuItem.findFirst({ where: { vendorId: profile.id, name: m.name } });
        if (!exists) {
          await db.menuItem.create({ data: { vendorId: profile.id, name: m.name, category: cat, description: m.desc, price: m.price, isAvailable: true } });
        }
      }
    }
    const menuItems = await db.menuItem.findMany({ where: { vendorId: profile.id } });
    const menus = new Map(menuItems.map((m) => [m.name, { id: m.id, price: m.price }]));
    const pick = (...names: string[]) => names.map((n) => menus.get(n)?.id).filter((x): x is string => !!x);

    const ensurePackage = async (name: string, price: number, otherCost: number, desc: string, menuIds: string[]) => {
      const existing = await db.package.findFirst({ where: { vendorId: profile.id, name } });
      if (existing) {
        const p = await db.package.update({ where: { id: existing.id }, data: { otherCostPerPax: otherCost, isActive: true } });
        return { id: p.id, name: p.name, pricePerPax: p.pricePerPax };
      }
      const p = await db.package.create({
        data: {
          vendorId: profile.id, name, pricePerPax: price, otherCostPerPax: otherCost, minPax: v.minPax, maxPax: v.maxPax,
          isActive: true, description: desc, items: { create: menuIds.map((menuItemId) => ({ menuItemId })) },
        },
      });
      return { id: p.id, name: p.name, pricePerPax: p.pricePerPax };
    };
    const hemat = await ensurePackage(
      "Nusantara Hemat", v.basePrice - 5000, 3500,
      "Paket ekonomis: nasi, 1 lauk utama, sayur, dessert, minuman + 1 snack.",
      pick("Nasi putih hangat", "Ayam bakar madu", "Capcay kuah", "Pudding cokelat vla", "Es teh manis", "Lemper ayam"),
    );
    const premium = await ensurePackage(
      "Nusantara Premium", v.basePrice, 4000,
      "Paket lengkap: nasi pilihan, 2 lauk premium, sayur, 2 dessert, minuman + pramusaji.",
      pick("Nasi kuning gurih", "Beef teriyaki", "Rendang sapi empuk", "Sop kimlo hangat", "Buah potong segar", "Es campur / es teler", "Jeruk peras hangat"),
    );
    vendors.push({ id: profile.id, userId: user.id, businessName: v.businessName, maxPax: v.maxPax, lat: v.lat, lng: v.lng, rate: v.rate, packages: { hemat, premium }, menus });
  }

  // Reset transaksi demo (termasuk data uji sebelumnya)
  const demoUserIds = [admin.id, ...Object.values(customers).map((c) => c.id), ...vendors.map((v) => v.userId)];
  await resetDemoData(vendors.map((v) => v.id), demoUserIds);

  // Bahan baku & resep — lengkap untuk Dapur Nusantara
  const dn = vendors[0];
  const ingIds = new Map<string, string>();
  for (const [name, unit, price] of INGREDIENTS) {
    const ing = await db.ingredient.upsert({
      where: { vendorId_name: { vendorId: dn.id, name } },
      update: { unit, pricePerUnit: price },
      create: { vendorId: dn.id, name, unit, pricePerUnit: price },
    });
    ingIds.set(name, ing.id);
  }
  for (const [menu, lines] of Object.entries(RECIPES)) {
    const m = dn.menus.get(menu);
    if (!m) continue;
    await db.menuItemIngredient.deleteMany({ where: { menuItemId: m.id } });
    await db.menuItemIngredient.createMany({
      data: lines.map(([ing, qty]) => ({ menuItemId: m.id, ingredientId: ingIds.get(ing)!, quantity: qty })),
    });
  }

  const ctx: Ctx = { vendors, customers };

  // --- Riwayat 6 bulan (analitik & ulasan) ---------------------------------
  const history: [number, CustomerKey, string, "WEDDING" | "CORPORATE" | "BIRTHDAY" | "GATHERING", number, number, "hemat" | "premium", number][] = [
    // [vendorIdx, customer, nama, tipe, hari lalu, tamu, paket, rating]
    [0, "sari", "Pernikahan Sari & Dimas", "WEDDING", 160, 300, "premium", 5],
    [0, "kantor", "Gathering Tahunan PT Maju Jaya", "GATHERING", 128, 150, "hemat", 5],
    [0, "andi", "Ulang Tahun Ibunda ke-60", "BIRTHDAY", 96, 80, "hemat", 4],
    [0, "kantor", "Seminar Produk Q2", "CORPORATE", 70, 120, "premium", 5],
    [0, "budi", "Tasyakuran Rumah Baru", "GATHERING", 41, 60, "hemat", 5],
    [0, "kantor", "Town Hall Agustus", "CORPORATE", 20, 200, "hemat", 4],
    [1, "sari", "Bridal Shower Nadia", "BIRTHDAY", 55, 50, "premium", 5],
    [2, "andi", "Aqiqah Keponakan", "GATHERING", 33, 120, "hemat", 4],
    [3, "budi", "Syukuran Wisuda", "GATHERING", 24, 70, "hemat", 5],
    [4, "kantor", "Seminar Hotel Santika", "CORPORATE", 15, 100, "premium", 5],
  ];
  for (const [vIdx, cust, name, type, ago, guests, pkg, rating] of history) {
    await createOrder(ctx, {
      vendorIdx: vIdx, customer: cust, pkg, origin: "CUSTOMER_REQUEST", quotationStatus: "ACCEPTED", createdDaysAgo: ago + 14,
      event: { name, type, dayOffset: -ago, time: "10:00–14:00", guests, location: "Gedung Serbaguna" },
      fees: { deliveryFee: 150000 },
      booking: { status: "COMPLETED", paid: true, review: rating },
    });
  }

  // --- Cerita aktif Dapur Nusantara ----------------------------------------
  // 1) Permintaan baru — untuk demo "konfirmasi langsung"
  const req = await createOrder(ctx, {
    vendorIdx: 0, customer: "budi", pkg: "premium", addOns: ["Kopi tubruk + teh"], origin: "CUSTOMER_REQUEST", quotationStatus: "REQUESTED",
    createdDaysAgo: 0.1, notes: "Mohon ada stall siomay live cooking bila bisa.",
    event: { name: "Pernikahan Budi & Sari", type: "WEDDING", dayOffset: 30, time: "10:00", guests: 250, location: "Gedung Sasono Utomo", at: [-7.2650, 112.7450] },
  });
  await addNotification(dn.userId, {
    type: "ORDER_REQUEST", title: "Permintaan pesanan baru", whatsapp: true, at: hoursFromNow(-2),
    message: `"Pernikahan Budi & Sari" (250 pax, 10:00) menunggu konfirmasi Anda.`, link: `/quotations/${req.quotation.id}`,
  });

  // 2) Penawaran khusus terkirim — menunggu keputusan pelanggan
  const offer = await createOrder(ctx, {
    vendorIdx: 0, customer: "andi", pkg: "hemat", addOns: ["Buah potong segar"], origin: "CUSTOMER_REQUEST", quotationStatus: "SENT",
    createdDaysAgo: 1, expiresInHours: 60, fees: { deliveryFee: 50000, discount: 100000 },
    extraItems: [{ name: "Nasi kotak anak (porsi kecil)", quantity: 30, unitPrice: 18000 }],
    notes: "Kami tambahkan 30 nasi kotak anak dan potongan Rp100.000 untuk langganan.",
    event: { name: "Aqiqah Baby Arka", type: "GATHERING", dayOffset: 12, time: "09:00", guests: 150, location: "Rumah, Pondok Mutiara", city: "Sidoarjo", at: [-7.4370, 112.7210] },
    history: [{ action: "sent", to: "SENT", actor: "vendor", hoursAgo: 20, note: "Vendor mengirim penawaran khusus atas permintaan pelanggan." }],
  });
  await addNotification(customers.andi.id, {
    type: "QUOTATION", title: "Penawaran khusus untuk permintaan Anda", whatsapp: true, at: hoursFromNow(-20),
    message: `Dapur Nusantara mengirim penawaran untuk "Aqiqah Baby Arka". Tinjau lalu terima, minta revisi, atau tolak.`, link: `/quotations/${offer.quotation.id}`,
  });

  // 3) Revisi diminta — vendor perlu memperbarui penawaran
  const rev = await createOrder(ctx, {
    vendorIdx: 0, customer: "kantor", pkg: "premium", origin: "CUSTOMER_REQUEST", quotationStatus: "REVISION_REQUESTED",
    createdDaysAgo: 2, expiresInHours: 30, fees: { deliveryFee: 100000 },
    revisionNote: "Bisa ganti rendang dengan ayam bakar dan ongkir digratiskan? Budget kami Rp6 juta.",
    event: { name: "Rapat Kerja Q4 PT Maju Jaya", type: "CORPORATE", dayOffset: 18, time: "12:00", guests: 180, location: "Kantor Pusat, Rungkut", at: [-7.3260, 112.7720] },
    history: [
      { action: "sent", to: "SENT", actor: "vendor", hoursAgo: 30, note: "Vendor mengirim penawaran khusus atas permintaan pelanggan." },
      { action: "revision_requested", to: "REVISION_REQUESTED", actor: "customer", hoursAgo: 5, note: "Bisa ganti rendang dengan ayam bakar dan ongkir digratiskan? Budget kami Rp6 juta." },
    ],
  });
  await addNotification(dn.userId, {
    type: "QUOTATION", title: "Pelanggan meminta revisi", whatsapp: true, at: hoursFromNow(-5),
    message: `"Rapat Kerja Q4 PT Maju Jaya": Bisa ganti rendang dengan ayam bakar dan ongkir digratiskan?`, link: `/quotations/${rev.quotation.id}`,
  });

  // 4) Menunggu pembayaran — dengan batas waktu berjalan
  const unpaid = await createOrder(ctx, {
    vendorIdx: 0, customer: "sari", pkg: "hemat", origin: "CUSTOMER_REQUEST", quotationStatus: "ACCEPTED", createdDaysAgo: 0.5,
    fees: { deliveryFee: 75000 },
    event: { name: "Arisan Keluarga Wijaya", type: "GATHERING", dayOffset: 9, time: "11:00", guests: 90, location: "Perum Graha Famili B-12", at: [-7.2967, 112.6886] },
    booking: { status: "PAYMENT_PENDING", paymentDueInHours: 18 },
  });
  await addNotification(customers.sari.id, {
    type: "BOOKING", title: "Pesanan dikonfirmasi vendor", whatsapp: true, at: hoursFromNow(-6),
    message: `Pesanan "Arisan Keluarga Wijaya" (90 pax) disetujui. Lunasi sebelum batas waktu agar jadwal tidak dilepas.`, link: `/bookings/${unpaid.booking!.id}`,
  });

  // 5) Hari produksi padat (H+3): lunas online + offline lunas + offline tentatif
  const paid = await createOrder(ctx, {
    vendorIdx: 0, customer: "kantor", pkg: "premium", addOns: ["Kopi tubruk + teh"], origin: "CUSTOMER_REQUEST", quotationStatus: "ACCEPTED",
    createdDaysAgo: 6, fees: { deliveryFee: 100000 },
    event: { name: "Syukuran Ulang Tahun PT Maju Jaya", type: "CORPORATE", dayOffset: 3, time: "11:30", guests: 120, location: "Rungkut Industri III/18", at: [-7.3330, 112.7650] },
    booking: { status: "PAID", paid: true },
  });
  await addNotification(dn.userId, {
    type: "PAYMENT", title: "Pembayaran lunas diterima", whatsapp: true, at: hoursFromNow(-30),
    message: `"Syukuran Ulang Tahun PT Maju Jaya" sudah dibayar lunas. Silakan jadwalkan produksi.`, link: "/vendor/orders",
  });
  await createOrder(ctx, {
    vendorIdx: 0, customer: { offlineName: "Ibu Ratna (RT 05)", offlinePhone: "0813-1111-2222" }, pkg: "hemat", addOns: ["Buah potong segar"],
    origin: "VENDOR_OFFLINE", quotationStatus: "ACCEPTED", createdDaysAgo: 4, fees: { deliveryFee: 30000 },
    event: { name: "Arisan Ibu-ibu RT 05", dayOffset: 3, time: "15:00", guests: 70, location: "Balai RW 3, Jl. Ketintang Baru", at: [-7.3150, 112.7270] },
    booking: { status: "PAID", paid: true, method: "CASH" },
  });
  await createOrder(ctx, {
    vendorIdx: 0, customer: { offlineName: "Pak Hendra", offlinePhone: "0812-3333-4444" }, pkg: "hemat",
    origin: "VENDOR_OFFLINE", quotationStatus: "ACCEPTED", createdDaysAgo: 1,
    event: { name: "Rapat Karang Taruna", dayOffset: 3, time: "19:00", guests: 40, location: "Pos Kamling RW 2", at: [-7.3100, 112.7300] },
    booking: { status: "PAYMENT_PENDING" },
  });

  // 6) Sedang diantar (hari ini) — untuk demo "Pesanan sudah diterima" oleh Budi
  const otw = await createOrder(ctx, {
    vendorIdx: 0, customer: "budi", pkg: "hemat", origin: "CUSTOMER_REQUEST", quotationStatus: "ACCEPTED", createdDaysAgo: 8,
    fees: { deliveryFee: 50000 },
    event: { name: "Pengajian Bulanan Masjid Al-Ikhlas", type: "GATHERING", dayOffset: 0, time: "18:30", guests: 100, location: "Masjid Al-Ikhlas, Ketintang", at: [-7.3165, 112.7290] },
    booking: { status: "DELIVERED", paid: true, departedHoursAgo: 0.5 },
  });
  await addNotification(customers.budi.id, {
    type: "DELIVERY", title: "Pesanan sedang diantar", whatsapp: true, at: hoursFromNow(-0.5),
    message: `Dapur Nusantara sedang mengantar pesanan "Pengajian Bulanan Masjid Al-Ikhlas". Tekan "Pesanan sudah diterima" saat makanan tiba.`,
    link: `/bookings/${otw.booking!.id}`,
  });

  // 7) Refund menunggu admin
  const refunded = await createOrder(ctx, {
    vendorIdx: 0, customer: "andi", pkg: "premium", origin: "CUSTOMER_REQUEST", quotationStatus: "ACCEPTED", createdDaysAgo: 10,
    event: { name: "Reuni SMA Angkatan 2010", type: "GATHERING", dayOffset: 25, time: "17:00", guests: 80, location: "Resto Taman Bungkul", at: [-7.2910, 112.7395] },
    booking: { status: "REFUND_PENDING", paid: true, cancel: { by: "CUSTOMER", reason: "Acara diundur ke tahun depan" } },
  });
  await addNotification(admin.id, {
    type: "REFUND", title: "Refund perlu diproses", at: hoursFromNow(-6),
    message: `Dapur Nusantara · "Reuni SMA Angkatan 2010".`, link: "/admin/orders?filter=refund",
  });
  await addNotification(dn.userId, {
    type: "BOOKING", title: "Pesanan dibatalkan", whatsapp: true, at: hoursFromNow(-6),
    message: `Pesanan "Reuni SMA Angkatan 2010" dibatalkan oleh pelanggan: Acara diundur ke tahun depan.`, link: `/bookings/${refunded.booking!.id}`,
  });

  // 8) Pesanan pelanggan ke vendor lain (agar katalog terasa hidup)
  await createOrder(ctx, {
    vendorIdx: 4, customer: "sari", pkg: "premium", origin: "CUSTOMER_REQUEST", quotationStatus: "ACCEPTED", createdDaysAgo: 3,
    event: { name: "Lamaran Nadia & Rizky", type: "WEDDING", dayOffset: 14, time: "10:00", guests: 60, location: "Rumah, Darmo Permai" },
    booking: { status: "PAID", paid: true },
  });

  // Invoice counter & kapasitas
  for (const [key, last] of invoiceSeq) {
    const [vendorId, year] = key.split(":");
    await db.invoiceCounter.create({ data: { vendorId, year: Number(year), last } });
  }
  await rebuildAvailability(vendors.map((v) => v.id));

  console.log("Seed demo selesai:");
  console.log("  • 5 vendor terverifikasi, katalog, riwayat 6 bulan + ulasan");
  console.log("  • Dapur Nusantara: bahan baku & resep lengkap, 1 permintaan baru, 1 penawaran, 1 revisi,");
  console.log("    1 menunggu bayar, hari produksi H+3 (3 pesanan), 1 sedang diantar hari ini, 1 refund menunggu admin");
  console.log("  • Notifikasi & kotak keluar WhatsApp terisi");
  console.log("  Akun (sandi demo1234): pelanggan@demo.id · vendor1@demo.id · admin@caterhub.id");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
