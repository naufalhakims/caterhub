"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-helpers";
import { isOfferParty } from "@/server/access";

const messageSchema = z.object({
  quotationId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(1, "Pesan tidak boleh kosong.")
    .max(2000, "Pesan maksimal 2000 karakter."),
});

/**
 * Kirim pesan pada penawaran. Hanya pelanggan & vendor pada penawaran tersebut.
 * PENTING: aksi ini tidak boleh mengubah status penawaran atau campur tangan pada
 * alur revisi/terima/tolak — chat murni komunikasi.
 */
export async function sendOfferMessageAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const quotationId = String(formData.get("quotationId") ?? "");
  if (!quotationId) redirect("/dashboard?error=Penawaran tidak ditemukan.");
  const parsed = messageSchema.safeParse({
    quotationId,
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) {
    redirect(
      `/quotations/${quotationId}?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Pesan tidak valid.",
      )}#chat`,
    );
  }

  const q = await db.quotation.findUnique({
    where: { id: parsed.data.quotationId },
    select: { id: true, customerId: true, vendor: { select: { userId: true, businessName: true } }, event: { select: { name: true } } },
  });
  if (!q) redirect("/dashboard?error=Penawaran tidak ditemukan.");

  // Admin sengaja TIDAK diikutsertakan dalam chat (tidak ada moderasi saat ini).
  if (!isOfferParty({ id: user.id, role: user.role }, { customerId: q.customerId, vendorUserId: q.vendor.userId })) {
    redirect("/dashboard?error=Akses ditolak.");
  }

  await db.offerMessage.create({
    data: { quotationId: q.id, senderId: user.id, body: parsed.data.body },
  });

  const recipientId = user.id === q.customerId ? q.vendor.userId : q.customerId;
  await db.notification.create({
    data: {
      userId: recipientId,
      type: "MESSAGE",
      title: "Pesan baru pada penawaran",
      message: `${user.name ?? "Pengguna"} mengirim pesan tentang "${q.event.name}".`,
    },
  });

  revalidatePath(`/quotations/${q.id}`);
  redirect(`/quotations/${q.id}?ok=${encodeURIComponent("Pesan terkirim.")}#chat`);
}
