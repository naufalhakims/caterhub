"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { quotationCreateSchema } from "@/lib/validations";
import { parseIDR } from "@/lib/money";
import { calcTotals } from "@/server/quotation";
import { acceptQuotationAndBook } from "@/server/booking";
import {
  canPerformQuotationDecision,
  nextQuotationStatus,
  type QuotationDecision,
} from "@/server/quotation-workflow";

/** Status yang isinya masih boleh diubah vendor sebelum pelanggan memutuskan. */
const EDITABLE_STATUSES = ["REQUESTED", "SENT", "REVISION_REQUESTED"] as const;

// Vendor mengirim penawaran (baru maupun revisi). Total dihitung server; item disimpan
// sebagai snapshot agar riwayat harga stabil.
export async function sendQuotationAction(formData: FormData) {
  const user = await requireRole("VENDOR");
  const vendor = await db.vendorProfile.findUnique({ where: { userId: user.id } });
  if (!vendor) redirect("/vendor/profile?error=Profil vendor belum dibuat.");
  // Vendor yang belum terverifikasi tidak boleh mengirim penawaran ke pelanggan.
  if (vendor.verificationStatus !== "VERIFIED") {
    redirect("/vendor/verification?error=Penawaran hanya bisa dikirim setelah verifikasi disetujui.");
  }

  // Dukung dua format form: itemsJson (JSON) atau baris itemName{i}/itemQty{i}/itemPrice{i}.
  let parsedItems: unknown = [];
  const rawItems = String(formData.get("itemsJson") ?? "");
  if (rawItems) {
    try {
      parsedItems = JSON.parse(rawItems);
    } catch {
      redirect("/vendor/quotations?error=Item tidak valid.");
    }
  } else {
    const rows: unknown[] = [];
    for (let i = 0; i < 50; i++) {
      const name = formData.get(`itemName${i}`);
      if (name == null) break;
      rows.push({
        name: String(name),
        quantity: Number(formData.get(`itemQty${i}`) ?? 0),
        // Harga bisa datang dalam format "Rp10.000" dari input.
        unitPrice: parseIDR(formData.get(`itemPrice${i}`)) ?? 0,
      });
    }
    parsedItems = rows;
  }
  const parsed = quotationCreateSchema.safeParse({
    eventId: formData.get("eventId"),
    customerId: formData.get("customerId"),
    packageId: formData.get("packageId") || undefined,
    items: parsedItems,
    deliveryFee: parseIDR(formData.get("deliveryFee")) ?? 0,
    serviceFee: parseIDR(formData.get("serviceFee")) ?? 0,
    discount: parseIDR(formData.get("discount")) ?? 0,
    notes: formData.get("notes") || undefined,
    expiresAt: formData.get("expiresAt") || undefined,
  });
  if (!parsed.success) {
    redirect(`/vendor/quotations?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Data tidak valid.")}`);
  }
  const d = parsed.data;
  const event = await db.event.findUnique({ where: { id: d.eventId } });
  if (!event || event.customerId !== d.customerId) redirect("/vendor/quotations?error=Akses ditolak.");

  const existingId = String(formData.get("quotationId") ?? "");
  const { subtotal, total } = calcTotals(d.items, d.deliveryFee, d.serviceFee, d.discount);
  const itemsData = d.items.map((i) => ({
    name: i.name,
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    subtotal: i.quantity * i.unitPrice,
  }));

  if (existingId) {
    const existing = await db.quotation.findUnique({ where: { id: existingId } });
    if (!existing || existing.vendorId !== vendor.id) redirect("/vendor/quotations?error=Akses ditolak.");
    if (existing.customerId !== d.customerId) redirect("/vendor/quotations?error=Akses ditolak.");
    if (!EDITABLE_STATUSES.includes(existing.status as (typeof EDITABLE_STATUSES)[number])) {
      redirect(`/vendor/quotations?error=Penawaran berstatus ${existing.status} tidak bisa diubah.`);
    }

    // REQUESTED → SENT (vendor menjawab permintaan) atau REVISION_REQUESTED → SENT.
    // Bila sudah SENT, vendor masih boleh memperbarui isi tanpa mengubah status.
    const nextStatus =
      existing.status === "REQUESTED" || existing.status === "REVISION_REQUESTED"
        ? "SENT"
        : existing.status;

    await db.quotation.update({
      where: { id: existing.id },
      data: {
        packageId: d.packageId, subtotal, deliveryFee: d.deliveryFee,
        serviceFee: d.serviceFee, discount: d.discount, total,
        notes: d.notes, expiresAt: d.expiresAt,
        // Permintaan pelanggan tetap tercatat sebagai permintaan pelanggan.
        origin: existing.origin,
        status: nextStatus,
        items: { deleteMany: {}, create: itemsData },
      },
    });
    await db.quotationHistory.create({
      data: {
        quotationId: existing.id,
        actorId: user.id,
        action: existing.status === "REQUESTED" ? "sent" : "revised",
        fromStatus: existing.status,
        toStatus: nextStatus,
        note: existing.status === "REQUESTED" ? "Vendor mengirim penawaran atas permintaan pelanggan." : "Vendor memperbarui penawaran.",
      },
    });
    await db.notification.create({
      data: {
        userId: d.customerId,
        type: "QUOTATION",
        title: existing.status === "REQUESTED" ? "Penawaran untuk permintaan Anda" : "Penawaran diperbarui",
        message: `Vendor ${vendor.businessName} memperbarui penawaran untuk "${event.name}".`,
      },
    });
    revalidateQuotation(existing.id);
    redirect(`/quotations/${existing.id}`);
  }

  // Penawaran inisiatif vendor (tanpa permintaan pelanggan).
  const q = await db.quotation.create({
    data: {
      eventId: d.eventId, packageId: d.packageId, vendorId: vendor.id,
      customerId: d.customerId, origin: "VENDOR_OFFER", status: "SENT",
      subtotal, deliveryFee: d.deliveryFee, serviceFee: d.serviceFee,
      discount: d.discount, total, notes: d.notes, expiresAt: d.expiresAt,
      items: { create: itemsData },
      history: {
        create: { actorId: user.id, action: "sent", toStatus: "SENT", note: "Vendor mengirim penawaran." },
      },
    },
  });
  await db.notification.create({
    data: {
      userId: d.customerId, type: "QUOTATION",
      title: "Penawaran baru diterima",
      message: `Vendor ${vendor.businessName} mengirim penawaran untuk "${event.name}".`,
    },
  });
  revalidateQuotation(q.id);
  redirect(`/quotations/${q.id}`);
}

/** Vendor menolak permintaan pelanggan (status REQUESTED → DECLINED). */
export async function declineQuotationRequestAction(formData: FormData) {
  const user = await requireRole("VENDOR");
  const vendor = await db.vendorProfile.findUnique({ where: { userId: user.id } });
  if (!vendor) redirect("/vendor/profile?error=Profil vendor belum dibuat.");

  const id = String(formData.get("quotationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!id) redirect("/vendor/quotations?error=Permintaan tidak ditemukan.");

  const q = await db.quotation.findUnique({ where: { id } });
  if (!q || q.vendorId !== vendor.id) redirect("/vendor/quotations?error=Akses ditolak.");
  if (!canPerformQuotationDecision({ decision: "decline_request", actorRole: "VENDOR", origin: q.origin, status: q.status })) {
    redirect(`/vendor/quotations?error=Permintaan ini tidak bisa ditolak (status ${q.status}).`);
  }

  await db.quotation.update({ where: { id: q.id }, data: { status: nextQuotationStatus("decline_request") } });
  await db.quotationHistory.create({
    data: {
      quotationId: q.id,
      actorId: user.id,
      action: "declined",
      fromStatus: q.status,
      toStatus: "DECLINED",
      note: reason || "Vendor menolak permintaan.",
    },
  });
  await db.notification.create({
    data: {
      userId: q.customerId,
      type: "QUOTATION",
      title: "Permintaan ditolak vendor",
      message: reason ? `Vendor menolak permintaan: ${reason}` : "Vendor tidak dapat memenuhi permintaan ini.",
    },
  });
  revalidateQuotation(q.id);
  redirect(`/vendor/quotations?ok=Permintaan ditolak.`);
}

const decisionSchema = z
  .object({
    quotationId: z.string().min(1),
    decision: z.enum(["accept", "reject", "revision"], {
      errorMap: () => ({ message: "Keputusan tidak valid." }),
    }),
    revisionNote: z.string().max(1000).optional(),
  })
  .refine((v) => v.decision !== "revision" || !!v.revisionNote?.trim(), {
    message: "Catatan revisi wajib diisi bila meminta revisi.",
    path: ["revisionNote"],
  });

const DECISION_MAP: Record<"accept" | "reject" | "revision", QuotationDecision> = {
  accept: "accept",
  reject: "reject",
  revision: "request_revision",
};

export async function quotationDecisionAction(formData: FormData) {
  // Hanya pelanggan pemilik penawaran yang boleh memutuskan.
  const user = await requireRole("CUSTOMER");
  const parsed = decisionSchema.safeParse({
    quotationId: String(formData.get("quotationId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    revisionNote: String(formData.get("revisionNote") ?? "") || undefined,
  });
  if (!parsed.success) {
    redirect(`/dashboard?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Keputusan tidak valid.")}`);
  }
  const { quotationId, decision, revisionNote } = parsed.data;
  const mapped = DECISION_MAP[decision];

  const q = await db.quotation.findUnique({ where: { id: quotationId } });
  if (!q) redirect("/dashboard?error=Penawaran tidak ditemukan.");
  if (q.customerId !== user.id) redirect("/dashboard?error=Akses ditolak.");
  if (
    !canPerformQuotationDecision({
      decision: mapped,
      actorRole: "CUSTOMER",
      origin: q.origin,
      status: q.status,
    })
  ) {
    redirect(
      `/quotations/${q.id}?error=${encodeURIComponent(`Penawaran berstatus ${q.status} tidak bisa diputuskan lagi.`)}`,
    );
  }

  if (mapped === "reject") {
    await db.quotation.update({ where: { id: q.id }, data: { status: "REJECTED" } });
    await db.quotationHistory.create({
      data: {
        quotationId: q.id,
        actorId: user.id,
        action: "rejected",
        fromStatus: q.status,
        toStatus: "REJECTED",
        note: "Pelanggan menolak penawaran.",
      },
    });
    redirect(`/quotations/${q.id}?ok=Penawaran ditolak.`);
  }
  if (mapped === "request_revision") {
    await db.quotation.update({
      where: { id: q.id },
      data: { status: "REVISION_REQUESTED", revisionNote: revisionNote!.trim() },
    });
    await db.quotationHistory.create({
      data: {
        quotationId: q.id,
        actorId: user.id,
        action: "revision_requested",
        fromStatus: q.status,
        toStatus: "REVISION_REQUESTED",
        note: revisionNote!.trim(),
      },
    });
    redirect(`/quotations/${q.id}?ok=Permintaan revisi terkirim.`);
  }

  // accept → booking transaksional (recheck kapasitas).
  // redirect() harus dipanggil DI LUAR try/catch karena ia melempar sinyal NEXT_REDIRECT.
  let bookingId: string | null = null;
  let failure: string | null = null;
  try {
    const booking = await acceptQuotationAndBook(q.id, user.id);
    bookingId = booking.id;
  } catch (e) {
    failure = (e as Error).message;
  }
  if (bookingId) redirect(`/bookings/${bookingId}`);
  redirect(`/quotations/${q.id}?error=${encodeURIComponent(failure ?? "Gagal menerima penawaran.")}`);
}

function revalidateQuotation(id: string) {
  revalidatePath(`/quotations/${id}`);
  revalidatePath("/vendor/quotations");
  revalidatePath("/dashboard");
}
