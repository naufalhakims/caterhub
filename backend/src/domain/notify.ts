import type { Prisma } from "@prisma/client";

/** Klien Prisma biasa maupun klien transaksi. */
export type Db = Prisma.TransactionClient;

export type NotificationInput = {
  type: string;
  title: string;
  message: string;
  /** Rute frontend yang dibuka saat notifikasi diklik. */
  link?: string;
};

export async function notify(db: Db, userId: string, input: NotificationInput) {
  await db.notification.create({ data: { userId, ...input } });
}

/** Kirim notifikasi ke semua admin (mis. refund perlu diproses). */
export async function notifyAdmins(db: Db, input: NotificationInput) {
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length === 0) return;
  await db.notification.createMany({ data: admins.map((a) => ({ userId: a.id, ...input })) });
}
