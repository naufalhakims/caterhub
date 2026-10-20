import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// ---------- Katalog ----------

const MENUS: Record<string, { name: string; price: number; desc: string }[]> = {
  "Nasi": [
    { name: "Nasi putih hangat", price: 0, desc: "Beras premium pulen, dimasak dadakan." },
    { name: "Nasi kuning gurih", price: 3000, desc: "Santan + kunyit, wangi pandan." },
    { name: "Nasi liwet Solo", price: 4000, desc: "Gurih santan dengan areh." },
  ],
  "Lauk": [
    { name: "Ayam bakar madu", price: 0, desc: "Ayam kampung, olesan madu bakar." },
    { name: "Beef teriyaki", price: 8000, desc: "Sapi iris saus teriyaki Jepang." },
    { name: "Rendang sapi empuk", price: 9000, desc: "Masak 6 jam, bumbu meresap." },
    { name: "Ikan asam manis", price: 5000, desc: "Gurame fillet saus segar." },
    { name: "Udang saus Padang", price: 9000, desc: "Udang windu bumbu pedas gurih." },
  ],
  "Sayur": [
    { name: "Capcay kuah", price: 0, desc: "Sayur segar pasar pagi." },
    { name: "Sop kimlo hangat", price: 0, desc: "Kuah bening, cocok hajatan." },
    { name: "Tumis buncis bawang putih", price: 0, desc: "Renyah, tidak lembek." },
  ],
  "Dessert": [
    { name: "Pudding cokelat vla", price: 0, desc: "Lembut, tidak terlalu manis." },
    { name: "Buah potong segar", price: 2000, desc: "Melon, semangka, nanas." },
    { name: "Es campur / es teler", price: 5000, desc: "Favorit acara siang." },
  ],
  "Minuman": [
    { name: "Es teh manis", price: 0, desc: "Teh melati diseduh pekat." },
    { name: "Jeruk peras hangat", price: 3000, desc: "Jeruk peras asli." },
    { name: "Kopi tubruk + teh", price: 4000, desc: "Corner kopi acara." },
  ],
  "Snack": [
    { name: "Lemper ayam", price: 2500, desc: "Ketan lembut isi ayam." },
    { name: "Risoles mayo", price: 3000, desc: "Renyah, isi smoked beef." },
    { name: "Pastel ayam", price: 2500, desc: "Kulit tipis renyah." },
  ],
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
};

const VENDORS: VendorSeed[] = [
  {
    businessName: "Dapur Nusantara",
    city: "Surabaya",
    phone: "0811-1111-111",
    address: "Jl. Raya Nginden No. 12, Surabaya",
    desc: "Spesialis prasmanan Jawa-Timuran untuk pernikahan & korporat. Dapur 500 pax/hari, tim pramusaji berseragam, dan stall live-cooking.",
    rating: 4.8, reviews: 214, basePrice: 35000, minPax: 100, maxPax: 600,
  },
  {
    businessName: "Rasa Prima Catering",
    city: "Surabaya",
    phone: "0812-2222-222",
    address: "Jl. Manyar Kertoarjo V No. 8, Surabaya",
    desc: "Catering modern dengan sentuhan internasional — teriyaki, pasta corner, dan dessert premium. Favorit gathering kantor.",
    rating: 4.6, reviews: 167, basePrice: 32000, minPax: 50, maxPax: 500,
  },
  {
    businessName: "Sajian Kita",
    city: "Sidoarjo",
    phone: "0813-3333-333",
    address: "Jl. Pahlawan No. 45, Sidoarjo",
    desc: "Harga bersahabat untuk hajatan kampung, arisan, dan nasi kotak harian. Bisa dadakan H-3 untuk di bawah 200 pax.",
    rating: 4.5, reviews: 189, basePrice: 28000, minPax: 30, maxPax: 400,
  },
  {
    businessName: "Pawon Ibu",
    city: "Gresik",
    phone: "0814-4444-444",
    address: "Jl. Veteran No. 21, Gresik",
    desc: "Masakan rumahan resep keluarga — liwet, botok, dan sayur lodeh yang bikin tamu nambah. Spesialis tasyakuran & aqiqah.",
    rating: 4.4, reviews: 132, basePrice: 25000, minPax: 30, maxPax: 350,
  },
  {
    businessName: "Kitchen 88",
    city: "Surabaya",
    phone: "0815-5555-555",
    address: "Jl. HR Muhammad No. 88, Surabaya",
    desc: "Segmen premium: bahan pilihan, plating cantik, dan coffee break corner. Langganan seminar hotel & wedding gedung.",
    rating: 4.7, reviews: 98, basePrice: 40000, minPax: 50, maxPax: 500,
  },
];

const REVIEW_TEXTS: [number, string][] = [
  [5, "Rasanya konsisten enak dari akad sampai resepsi. Tamu sampai nambah dua kali!"],
  [5, "Pramusajinya sigap, stall sate-nya nggak pernah sepi. Recommended."],
  [4, "Enak dan tepat waktu. Porsinya pas untuk 200 tamu, masih sisa sedikit."],
  [5, "Sudah 3x pakai untuk acara kantor, nggak pernah kecewa. Admin fast respon."],
  [4, "Dessert-nya juara. Sayur sedikit kurang hangat pas jam makan, tapi overall puas."],
];

const CUSTOMERS: [string, string][] = [
  ["Sari Wijaya", "sari@demo.id"],
  ["Andi Pratama", "andi@demo.id"],
  ["PT Maju Jaya", "kantor@demo.id"],
];

const PAST_EVENTS: {
  customerIdx: number; name: string; type: "WEDDING" | "CORPORATE" | "BIRTHDAY" | "GATHERING";
  daysAgo: number; guests: number; city: "Surabaya" | "Sidoarjo" | "Gresik";
  venue: string; budget: number;
}[] = [
  { customerIdx: 0, name: "Pernikahan Sari & Dimas", type: "WEDDING", daysAgo: 75, guests: 300, city: "Surabaya", venue: "Gedung Sasono Utomo", budget: 12000000 },
  { customerIdx: 2, name: "Gathering Tahunan PT Maju Jaya", type: "GATHERING", daysAgo: 52, guests: 150, city: "Surabaya", venue: "Kantor Pusat, Rungkut", budget: 6000000 },
  { customerIdx: 1, name: "Ulang Tahun Ibunda ke-60", type: "BIRTHDAY", daysAgo: 30, guests: 80, city: "Sidoarjo", venue: "Rumah, Pondok Mutiara", budget: 3000000 },
  { customerIdx: 2, name: "Seminar Produk Q3", type: "CORPORATE", daysAgo: 12, guests: 120, city: "Gresik", venue: "Hotel Santika Gresik", budget: 5000000 },
  { customerIdx: 0, name: "Tasyakuran Rumah Baru", type: "GATHERING", daysAgo: 5, guests: 60, city: "Surabaya", venue: "Cluster Graha Famili", budget: 2500000 },
];

// ---------- Helper ----------

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------- Seed ----------

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  await db.user.upsert({
    where: { email: "admin@caterhub.id" },
    update: {},
    create: { name: "Admin CaterHub", email: "admin@caterhub.id", passwordHash, role: "ADMIN" },
  });

  const mainCustomer = await db.user.upsert({
    where: { email: "pelanggan@demo.id" },
    update: {},
    create: { name: "Budi Santoso", email: "pelanggan@demo.id", passwordHash, role: "CUSTOMER" },
  });

  const extraUsers = [];
  for (const [name, email] of CUSTOMERS) {
    extraUsers.push(
      await db.user.upsert({
        where: { email },
        update: {},
        create: { name, email, passwordHash, role: "CUSTOMER" },
      })
    );
  }

  // Vendors + menu + paket
  const profiles: { profileId: string; vendor: VendorSeed; pkgIds: { hemat: string; premium: string } }[] = [];
  let vi = 0;
  for (const v of VENDORS) {
    vi++;
    const email = `vendor${vi}@demo.id`;
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: { name: v.businessName, email, passwordHash, role: "VENDOR" },
    });
    const profile = await db.vendorProfile.upsert({
      where: { userId: user.id },
      update: {
        businessName: v.businessName, city: v.city, phone: v.phone, address: v.address,
        description: v.desc, verificationStatus: "VERIFIED",
        rating: v.rating, reviewCount: v.reviews, minPax: v.minPax, maxPax: v.maxPax,
      },
      create: {
        userId: user.id, businessName: v.businessName, city: v.city, phone: v.phone,
        address: v.address, description: v.desc, verificationStatus: "VERIFIED",
        rating: v.rating, reviewCount: v.reviews, minPax: v.minPax, maxPax: v.maxPax,
      },
    });

    for (const [cat, list] of Object.entries(MENUS)) {
      for (const m of list) {
        const exists = await db.menuItem.findFirst({ where: { vendorId: profile.id, name: m.name } });
        if (!exists) {
          await db.menuItem.create({
            data: { vendorId: profile.id, name: m.name, category: cat, description: m.desc, price: m.price, isAvailable: true },
          });
        }
      }
    }
    const menuItems = await db.menuItem.findMany({ where: { vendorId: profile.id }, orderBy: { name: "asc" } });
    const byName = new Map(menuItems.map((m) => [m.name, m.id]));
    const pick = (...names: string[]) => names.map((n) => byName.get(n)).filter((x): x is string => !!x);

    const hematMenu = pick("Nasi putih hangat", "Ayam bakar madu", "Capcay kuah", "Pudding cokelat vla", "Es teh manis", "Lemper ayam");
    const premiumMenu = pick(
      "Nasi kuning gurih", "Beef teriyaki", "Rendang sapi empuk", "Sop kimlo hangat",
      "Buah potong segar", "Es campur / es teler", "Jeruk peras hangat"
    );

    const ensurePackage = async (name: string, price: number, desc: string, menuIds: string[]) => {
      const existing = await db.package.findFirst({ where: { vendorId: profile.id, name } });
      if (existing) return existing.id;
      const created = await db.package.create({
        data: {
          vendorId: profile.id, name, pricePerPax: price, minPax: v.minPax, maxPax: v.maxPax,
          isActive: true, description: desc,
          items: { create: menuIds.map((menuItemId) => ({ menuItemId })) },
        },
      });
      return created.id;
    };

    const hemat = await ensurePackage(
      "Nusantara Hemat", v.basePrice - 5000,
      "Paket ekonomis: nasi, 1 lauk utama, sayur, dessert, minuman + 1 snack.",
      hematMenu.length ? hematMenu : menuItems.slice(0, 6).map((m) => m.id)
    );
    const premium = await ensurePackage(
      "Nusantara Premium", v.basePrice,
      "Paket lengkap: nasi pilihan, 2 lauk premium, sayur, 2 dessert, minuman + pramusaji.",
      premiumMenu.length ? premiumMenu : menuItems.slice(0, 7).map((m) => m.id)
    );
    profiles.push({ profileId: profile.id, vendor: v, pkgIds: { hemat, premium } });
  }

  // Riwayat transaksi masa lalu (di semua vendor, agar dashboard & analitik hidup)
  let qi = 0;
  for (const pe of PAST_EVENTS) {
    const slot = profiles[qi % profiles.length];
    qi++;
    const cust = extraUsers[pe.customerIdx];
    const pkg = await db.package.findUniqueOrThrow({ where: { id: slot.pkgIds.premium } });
    const eventDate = daysFromNow(-pe.daysAgo);
    const paidAt = new Date(eventDate);
    paidAt.setDate(paidAt.getDate() - 7);

    const dup = await db.event.findFirst({
      where: { customerId: cust.id, name: pe.name },
    });
    if (dup) continue;

    const event = await db.event.create({
      data: {
        customerId: cust.id, name: pe.name, eventType: pe.type, eventDate,
        eventTime: "10.00–14.00", location: pe.venue, city: pe.city,
        guestCount: pe.guests, budgetMin: Math.round(pe.budget * 0.8), budgetMax: pe.budget,
      },
    });
    const subtotal = pkg.pricePerPax * pe.guests;
    const total = subtotal + 150000;
    const quotation = await db.quotation.create({
      data: {
        eventId: event.id, packageId: pkg.id, vendorId: slot.profileId, customerId: cust.id,
        status: "ACCEPTED", subtotal, deliveryFee: 150000, serviceFee: 0, discount: 0,
        total, notes: "Sudah termasuk pramusaji & alat makan.",
        items: {
          create: [{
            name: `Paket ${pkg.name} (${pe.guests} pax)`,
            quantity: pe.guests, unitPrice: pkg.pricePerPax, subtotal,
          }],
        },
      },
    });
    const booking = await db.booking.create({
      data: {
        eventId: event.id, quotationId: quotation.id, vendorId: slot.profileId, customerId: cust.id,
        status: "COMPLETED", totalAmount: total,
        depositAmount: Math.round(total * 0.5), remainingAmount: total - Math.round(total * 0.5),
        confirmedAt: paidAt,
      },
    });
    await db.payment.create({
      data: {
        bookingId: booking.id, provider: "mock", providerReference: `SEED-PAST-${booking.id.slice(-8)}`,
        amount: total, method: "QRIS", status: "SETTLEMENT", paidAt,
        qrPayload: `MOCK-QRIS:${booking.id}:${total}`,
      },
    });
    const day = new Date(eventDate);
    await db.availability.upsert({
      where: { vendorId_date: { vendorId: slot.profileId, date: day } },
      update: { reservedPax: { increment: pe.guests } },
      create: { vendorId: slot.profileId, date: day, maxPax: slot.vendor.maxPax, reservedPax: pe.guests },
    });

    const [rating, comment] = REVIEW_TEXTS[qi % REVIEW_TEXTS.length];
    await db.review.create({
      data: { bookingId: booking.id, customerId: cust.id, vendorId: slot.profileId, rating, comment },
    });
  }

  // Skenario demo masa depan: pernikahan 250 pax di Dapur Nusantara (vendor1)
  const demo = profiles[0];
  const demoPkg = await db.package.findUniqueOrThrow({ where: { id: demo.pkgIds.premium } });
  let demoEvent = await db.event.findFirst({
    where: { customerId: mainCustomer.id, name: "Pernikahan Budi & Sari" },
  });
  if (!demoEvent) {
    demoEvent = await db.event.create({
      data: {
        customerId: mainCustomer.id, name: "Pernikahan Budi & Sari", eventType: "WEDDING",
        eventDate: daysFromNow(30), eventTime: "10.00–14.00",
        location: "Gedung Sasono Utomo", city: "Surabaya", guestCount: 250,
        budgetMin: 7000000, budgetMax: 10000000,
        notes: "250 tamu, prasmanan + 1 stall live cooking.",
      },
    });
    const guests = 250;
    const subtotal = demoPkg.pricePerPax * guests;
    const total = subtotal + 200000 + 175000 - 250000;
    await db.quotation.create({
      data: {
        eventId: demoEvent.id, packageId: demoPkg.id, vendorId: demo.profileId,
        customerId: mainCustomer.id, status: "SENT",
        subtotal, deliveryFee: 200000, serviceFee: 175000, discount: 250000, total,
        notes: "Penawaran awal: paket premium + stall siomay live cooking.",
        expiresAt: daysFromNow(14),
        items: {
          create: [
            { name: `Paket ${demoPkg.name} (${guests} pax)`, quantity: guests, unitPrice: demoPkg.pricePerPax, subtotal },
            { name: "Stall siomay live cooking", quantity: 1, unitPrice: 0, subtotal: 0 },
          ],
        },
      },
    });
    await db.notification.create({
      data: {
        userId: mainCustomer.id, type: "QUOTATION", title: "Penawaran baru diterima",
        message: `Dapur Nusantara mengirim penawaran untuk "Pernikahan Budi & Sari".`,
      },
    });
  }

  console.log("Seed selesai: 5 vendor, katalog, riwayat transaksi, ulasan, + 1 skenario demo aktif.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
