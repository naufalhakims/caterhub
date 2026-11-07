import type { Prisma } from "@prisma/client";
import { env } from "../env";
import { formatWhatsAppMessage, resolveWhatsAppTarget } from "./whatsapp";

/** Klien Prisma biasa maupun klien transaksi. */
export type Db = Prisma.TransactionClient;

export type NotificationInput = {
  type: string;
  title: string;
  message: string;
  /** Rute frontend yang dibuka saat notifikasi diklik. */
  link?: string;
  /** Juga kirim lewat WhatsApp (hanya untuk event penting). */
  whatsapp?: boolean;
};

/**
 * Notifikasi aplikasi + (opsional) baris outbox WhatsApp dalam transaksi yang
 * sama — bila transaksi gagal, pesan WA juga tidak pernah terkirim.
 */
export async function notify(db: Db, userId: string, input: NotificationInput) {
  const { whatsapp, ...data } = input;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, phone: true, whatsappOptIn: true, isPlaceholder: true, vendorProfile: { select: { phone: true } } },
  });
  // Akun placeholder (pesanan offline) tidak bisa membaca notifikasi.
  if (!user || user.isPlaceholder) return;
  await db.notification.create({ data: { userId, ...data } });
  if (!whatsapp) return;

  const target = resolveWhatsAppTarget({
    role: user.role,
    optIn: user.whatsappOptIn,
    userPhone: user.phone,
    vendorPhone: user.vendorProfile?.phone ?? null,
  });
  await db.whatsAppMessage.create({
    data: {
      userId,
      toPhone: target.phone,
      event: data.type,
      body: formatWhatsAppMessage({ title: data.title, message: data.message, link: data.link, appUrl: env.appUrl }),
      status: target.send ? "QUEUED" : "SKIPPED",
      error: target.send ? null : target.reason,
    },
  });
}

/** Kirim notifikasi ke semua admin (mis. refund perlu diproses). Tanpa WhatsApp. */
export async function notifyAdmins(db: Db, input: Omit<NotificationInput, "whatsapp">) {
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length === 0) return;
  await db.notification.createMany({ data: admins.map((a) => ({ userId: a.id, ...input })) });
}
