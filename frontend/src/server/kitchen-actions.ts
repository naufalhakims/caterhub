"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiError, apiDelete, apiPatch, apiPost, apiPut } from "@/lib/api";
import { requireVendor } from "@/server/vendor-helpers";
import { parseIDR } from "@/lib/money";

const COSTING = "/vendor/costing";

function back(tab: string, key: "ok" | "error", message: string): never {
  redirect(`${COSTING}?tab=${tab}&${key}=${encodeURIComponent(message)}`);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function refresh() {
  revalidatePath(COSTING);
  revalidatePath("/vendor/production");
}

export async function upsertIngredientAction(formData: FormData): Promise<never> {
  await requireVendor();
  const id = String(formData.get("id") ?? "");
  try {
    await apiPost("/api/v1/vendor/ingredients", {
      id: id || undefined,
      name: String(formData.get("name") ?? ""),
      unit: String(formData.get("unit") ?? "kg"),
      pricePerUnit: parseIDR(formData.get("pricePerUnit")) ?? 0,
    });
  } catch (error) {
    back("bahan", "error", errorMessage(error, "Bahan gagal disimpan."));
  }
  refresh();
  back("bahan", "ok", id ? "Harga bahan diperbarui — HPP ikut dihitung ulang." : "Bahan ditambahkan.");
}

export async function deleteIngredientAction(formData: FormData): Promise<never> {
  await requireVendor();
  try {
    await apiDelete(`/api/v1/vendor/ingredients/${String(formData.get("id") ?? "")}`);
  } catch (error) {
    back("bahan", "error", errorMessage(error, "Bahan gagal dihapus."));
  }
  refresh();
  back("bahan", "ok", "Bahan dihapus dari daftar dan semua resep.");
}

export async function saveRecipeAction(formData: FormData): Promise<never> {
  await requireVendor();
  const menuId = String(formData.get("menuId") ?? "");
  const ids = formData.getAll("ingredientId").map(String);
  const qtys = formData.getAll("quantity").map((v) => Number(String(v).replace(",", ".")));
  const lines = ids
    .map((ingredientId, i) => ({ ingredientId, quantity: qtys[i] ?? 0 }))
    .filter((l) => l.ingredientId && l.quantity > 0);
  try {
    await apiPut(`/api/v1/vendor/menu/${menuId}/recipe`, { lines });
  } catch (error) {
    back("resep", "error", errorMessage(error, "Resep gagal disimpan."));
  }
  refresh();
  redirect(`${COSTING}?tab=resep&ok=${encodeURIComponent("Resep disimpan.")}#menu-${menuId}`);
}

export async function savePackageCostAction(formData: FormData): Promise<never> {
  await requireVendor();
  const id = String(formData.get("id") ?? "");
  try {
    await apiPatch(`/api/v1/vendor/packages/${id}/cost`, {
      otherCostPerPax: parseIDR(formData.get("otherCostPerPax")) ?? 0,
    });
  } catch (error) {
    back("paket", "error", errorMessage(error, "Biaya gagal disimpan."));
  }
  refresh();
  back("paket", "ok", "Biaya lain per porsi disimpan.");
}
