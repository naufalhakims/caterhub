"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireVendor } from "@/server/vendor-helpers";
import { canTransitionBooking, cancelBookingAndRelease } from "@/server/booking";
import { setDailyCapacity } from "@/server/capacity";
import { parseDateOnly } from "@/lib/date";
import { zIdr, zIdrWithDefault } from "@/lib/money";
import { deletePublicImage, savePublicImage, validateUpload } from "@/server/storage";

function hasFile(v: FormDataEntryValue | null): v is File {
  return typeof v === "object" && v !== null && typeof (v as File).size === "number" && (v as File).size > 0;
}

/** Simpan gambar baru (bila ada) dan hapus yang lama. */
async function resolveImage(
  formData: FormData,
  folder: string,
  current: string | null,
): Promise<string | null> {
  const file = formData.get("image");
  if (hasFile(file)) {
    const upload = await validateUpload(file, { imagesOnly: true });
    const url = await savePublicImage(folder, upload);
    await deletePublicImage(current);
    return url;
  }
  if (formData.get("removeImage") === "on") {
    await deletePublicImage(current);
    return null;
  }
  return current;
}

const menuSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().default("Lauk"),
  price: zIdrWithDefault(0),
  isAvailable: z.coerce.boolean().default(true),
});

export async function upsertMenuAction(formData: FormData) {
  const { vendor } = await requireVendor();
  const parsed = menuSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    category: formData.get("category") || "Lauk",
    price: formData.get("price") ?? 0,
    isAvailable: formData.get("isAvailable") !== "off",
  });
  if (!parsed.success) {
    redirect(`/vendor/menu?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Data menu tidak valid.")}`);
  }
  const id = String(formData.get("id") ?? "");
  const existing = id ? await db.menuItem.findUnique({ where: { id } }) : null;
  if (id && (!existing || existing.vendorId !== vendor.id)) redirect("/vendor/menu?error=Akses ditolak.");

  let imageUrl: string | null = existing?.imageUrl ?? null;
  try {
    imageUrl = await resolveImage(formData, `menu/${vendor.id}`, existing?.imageUrl ?? null);
  } catch (e) {
    redirect(`/vendor/menu?error=${encodeURIComponent((e as Error).message)}`);
  }

  if (existing) {
    await db.menuItem.update({ where: { id: existing.id }, data: { ...parsed.data, imageUrl } });
  } else {
    await db.menuItem.create({ data: { vendorId: vendor.id, ...parsed.data, imageUrl } });
  }
  revalidatePath("/vendor/menu");
  revalidatePath(`/catering/${vendor.id}`);
  redirect("/vendor/menu?ok=Menu berhasil disimpan.");
}

export async function deleteMenuAction(formData: FormData) {
  const { vendor } = await requireVendor();
  const id = String(formData.get("id") ?? "");
  const m = await db.menuItem.findUnique({ where: { id } });
  if (!m || m.vendorId !== vendor.id) redirect("/vendor/menu?error=Akses ditolak.");
  await db.menuItem.delete({ where: { id } });
  await deletePublicImage(m.imageUrl);
  revalidatePath("/vendor/menu");
  redirect("/vendor/menu?ok=Menu dihapus.");
}

const packageSchema = z
  .object({
    name: z.string().min(2),
    description: z.string().optional(),
    pricePerPax: zIdr,
    minPax: z.coerce.number().int().min(1).default(50),
    maxPax: z.coerce.number().int().min(1).default(500),
    isActive: z.coerce.boolean().default(true),
  })
  .refine((v) => v.minPax <= v.maxPax, {
    message: "Min pax tidak boleh lebih besar dari maks pax.",
  });

export async function upsertPackageAction(formData: FormData) {
  const { vendor } = await requireVendor();
  const parsed = packageSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    pricePerPax: formData.get("pricePerPax") ?? 0,
    minPax: formData.get("minPax") ?? 50,
    maxPax: formData.get("maxPax") ?? 500,
    isActive: formData.get("isActive") !== "off",
  });
  if (!parsed.success)
    redirect(
      `/vendor/packages?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Data paket tidak valid.")}`,
    );
  const id = String(formData.get("id") ?? "");
  const menuIds = formData.getAll("menuIds").map(String);
  const ownCount = await db.menuItem.count({ where: { id: { in: menuIds }, vendorId: vendor.id } });
  if (menuIds.length > 0 && ownCount !== menuIds.length) redirect("/vendor/packages?error=Menu tidak valid.");

  const existing = id ? await db.package.findUnique({ where: { id } }) : null;
  if (id && (!existing || existing.vendorId !== vendor.id)) redirect("/vendor/packages?error=Akses ditolak.");

  let imageUrl: string | null = existing?.imageUrl ?? null;
  try {
    imageUrl = await resolveImage(formData, `packages/${vendor.id}`, existing?.imageUrl ?? null);
  } catch (e) {
    redirect(`/vendor/packages?error=${encodeURIComponent((e as Error).message)}`);
  }

  if (existing) {
    await db.package.update({
      where: { id: existing.id },
      data: {
        ...parsed.data,
        imageUrl,
        items: { deleteMany: {}, create: menuIds.map((menuItemId) => ({ menuItemId })) },
      },
    });
  } else {
    await db.package.create({
      data: {
        vendorId: vendor.id,
        ...parsed.data,
        imageUrl,
        items: { create: menuIds.map((menuItemId) => ({ menuItemId })) },
      },
    });
  }
  revalidatePath("/vendor/packages");
  revalidatePath(`/catering/${vendor.id}`);
  redirect("/vendor/packages?ok=Paket berhasil disimpan.");
}

const CITY_VALUES = ["Surabaya", "Sidoarjo", "Gresik"] as const;

const vendorProfileSchema = z
  .object({
    businessName: z.string().min(2, "Nama usaha minimal 2 karakter."),
    description: z.string().max(2000).optional(),
    phone: z.string().max(30).optional(),
    address: z.string().max(200).optional(),
    city: z.enum(CITY_VALUES),
    minPax: z.coerce.number().int().min(1, "Min pax minimal 1."),
    maxPax: z.coerce.number().int().min(1, "Maks pax minimal 1."),
  })
  .refine((v) => v.minPax <= v.maxPax, { message: "Min pax tidak boleh lebih besar dari maks pax." });

export async function updateVendorProfileAction(formData: FormData) {
  const { vendor } = await requireVendor();
  const parsed = vendorProfileSchema.safeParse({
    businessName: formData.get("businessName") ?? vendor.businessName,
    description: formData.get("description") ?? "",
    phone: formData.get("phone") ?? "",
    address: formData.get("address") ?? "",
    city: formData.get("city") ?? vendor.city,
    minPax: formData.get("minPax") ?? vendor.minPax,
    maxPax: formData.get("maxPax") ?? vendor.maxPax,
  });
  if (!parsed.success)
    redirect(
      `/vendor/profile?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Data profil tidak valid.")}`,
    );
  await db.vendorProfile.update({
    where: { id: vendor.id },
    data: {
      ...parsed.data,
      description: parsed.data.description ?? "",
      phone: parsed.data.phone ?? "",
      address: parsed.data.address ?? "",
    },
  });
  revalidatePath("/vendor/profile");
  redirect("/vendor/profile?ok=Profil berhasil disimpan.");
}

const capacitySchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi."),
  maxPax: z.coerce.number().int().min(0, "Kapasitas tidak boleh negatif."),
});

export async function upsertCapacityAction(formData: FormData) {
  const { vendor } = await requireVendor();
  const parsed = capacitySchema.safeParse({
    date: formData.get("date"),
    maxPax: formData.get("maxPax") ?? 0,
  });
  if (!parsed.success)
    redirect(
      `/vendor/capacity?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Data tidak valid.")}`,
    );
  try {
    parseDateOnly(parsed.data.date);
    await setDailyCapacity(vendor.id, parsed.data.date, parsed.data.maxPax);
  } catch (e) {
    redirect(`/vendor/capacity?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/vendor/capacity");
  redirect("/vendor/capacity?ok=Kapasitas berhasil disimpan.");
}

export async function advanceBookingAction(formData: FormData) {
  const { vendor } = await requireVendor();
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "");
  const b = await db.booking.findUnique({ where: { id } });
  if (!b || b.vendorId !== vendor.id) redirect("/vendor/orders?error=Akses ditolak.");
  if (to === "CANCELLED") {
    try {
      await cancelBookingAndRelease(id, { vendorId: vendor.id });
    } catch (e) {
      redirect(`/vendor/orders?error=${encodeURIComponent((e as Error).message)}`);
    }
    revalidatePath("/vendor/orders");
    revalidatePath("/vendor/capacity");
    redirect("/vendor/orders?ok=Pesanan dibatalkan dan kapasitas dikembalikan.");
  }
  if (!canTransitionBooking(b.status, to)) redirect("/vendor/orders?error=Transisi status tidak valid.");
  await db.booking.update({ where: { id }, data: { status: to as never } });
  revalidatePath("/vendor/orders");
  redirect("/vendor/orders?ok=Status pesanan diperbarui.");
}
