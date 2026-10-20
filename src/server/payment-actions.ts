"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth-helpers";
import { getPaymentProvider } from "@/server/payment";

// Buat payment untuk booking milik customer. Deposit default 50%.
export async function createPaymentAction(formData: FormData) {
  const user = await requireCustomer();
  const bookingId = String(formData.get("bookingId") ?? "");
  const kind = String(formData.get("kind") ?? "deposit"); // deposit | full | remaining
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.customerId !== user.id) redirect("/dashboard?error=Akses ditolak.");
  if (booking.status === "CANCELLED") redirect(`/bookings/${booking.id}?error=Pesanan dibatalkan.`);

  const paid = await db.payment.aggregate({
    where: { bookingId, status: "SETTLEMENT" },
    _sum: { amount: true },
  });
  const paidSoFar = paid._sum.amount ?? 0;
  const amount =
    kind === "full"
      ? booking.totalAmount - paidSoFar
      : kind === "remaining"
        ? booking.remainingAmount - Math.max(0, paidSoFar - booking.depositAmount)
        : booking.depositAmount - Math.min(paidSoFar, booking.depositAmount);
  if (amount <= 0) redirect(`/bookings/${booking.id}?error=Pesanan sudah lunas.`);

  const provider = getPaymentProvider();
  const result = await provider.createPayment({
    bookingId,
    amount,
    customerEmail: user.email,
  });
  const payment = await db.payment.create({
    data: {
      bookingId,
      provider: provider.name,
      providerReference: result.providerReference,
      amount,
      method: "QRIS",
      status: "PENDING",
      qrPayload: result.qrPayload,
    },
  });
  redirect(`/payments/${payment.id}`);
}
