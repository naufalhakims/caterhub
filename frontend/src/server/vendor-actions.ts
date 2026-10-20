"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError, apiDelete, apiForm, apiPatch, apiPost } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";

function fail(to: string, message: string): never {
  redirect(`${to}?error=${encodeURIComponent(message)}`);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Menu: FormData diteruskan apa adanya (termasuk file gambar) ke API. */
export async function upsertMenuAction(formData: FormData): Promise<never> {
  await requireVendor();
  try {
    await apiForm("/api/v1/vendor/menu", formData);
  } catch (error) {
    fail("/vendor/menu", errorMessage(error, "Data menu tidak valid."));
  }
  revalidatePath("/vendor/menu");
  revalidatePath("/catering");
  redirect("/vendor/menu?ok=Menu berhasil disimpan.");
}

export async function deleteMenuAction(formData: FormData): Promise<never> {
  await requireVendor();
  const id = String(formData.get("id") ?? "");
  try {
    await apiDelete(`/api/v1/vendor/menu/${id}`);
  } catch (error) {
    fail("/vendor/menu", errorMessage(error, "Menu gagal dihapus."));
  }
  revalidatePath("/vendor/menu");
  redirect("/vendor/menu?ok=Menu dihapus.");
}

/** Paket: FormData diteruskan apa adanya (termasuk file & menuIds). */
export async function upsertPackageAction(formData: FormData): Promise<never> {
  await requireVendor();
  try {
    await apiForm("/api/v1/vendor/packages", formData);
  } catch (error) {
    fail("/vendor/packages", errorMessage(error, "Data paket tidak valid."));
  }
  revalidatePath("/vendor/packages");
  revalidatePath("/catering");
  redirect("/vendor/packages?ok=Paket berhasil disimpan.");
}

export async function updateVendorProfileAction(formData: FormData): Promise<never> {
  await requireVendor();
  try {
    await apiPatch("/api/v1/vendor/me", {
      businessName: String(formData.get("businessName") ?? ""),
      description: String(formData.get("description") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      address: String(formData.get("address") ?? ""),
      city: String(formData.get("city") ?? ""),
      minPax: String(formData.get("minPax") ?? ""),
      maxPax: String(formData.get("maxPax") ?? ""),
    });
  } catch (error) {
    fail("/vendor/profile", errorMessage(error, "Data profil tidak valid."));
  }
  revalidatePath("/vendor/profile");
  redirect("/vendor/profile?ok=Profil berhasil disimpan.");
}

export async function upsertCapacityAction(formData: FormData): Promise<never> {
  await requireVendor();
  try {
    await apiPost("/api/v1/vendor/capacity", {
      date: String(formData.get("date") ?? ""),
      maxPax: String(formData.get("maxPax") ?? ""),
    });
  } catch (error) {
    fail("/vendor/capacity", errorMessage(error, "Kapasitas gagal disimpan."));
  }
  revalidatePath("/vendor/capacity");
  redirect("/vendor/capacity?ok=Kapasitas berhasil disimpan.");
}

export async function advanceBookingAction(formData: FormData): Promise<never> {
  await requireVendor();
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "");
  try {
    await apiPost(`/api/v1/vendor/bookings/${id}/advance`, { to });
  } catch (error) {
    fail("/vendor/orders", errorMessage(error, "Status pesanan gagal diperbarui."));
  }
  revalidatePath("/vendor/orders");
  revalidatePath("/vendor/capacity");
  redirect(
    to === "CANCELLED"
      ? "/vendor/orders?ok=Pesanan dibatalkan dan kapasitas dikembalikan."
      : "/vendor/orders?ok=Status pesanan diperbarui.",
  );
}
