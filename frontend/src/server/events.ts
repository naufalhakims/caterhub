"use server";

import { redirect } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";
import { requireCustomer } from "@/lib/auth-helpers";

/** Titik peta dari LocationPicker; kosong bila pin belum ditaruh. */
function pinFrom(formData: FormData): { latitude?: number; longitude?: number } {
  const lat = Number(formData.get("latitude"));
  const lng = Number(formData.get("longitude"));
  return formData.get("latitude") && formData.get("longitude") && Number.isFinite(lat) && Number.isFinite(lng)
    ? { latitude: lat, longitude: lng }
    : {};
}

export async function createEventAction(formData: FormData): Promise<never> {
  // Peran tetap dicek di frontend untuk UX; API juga menegakkan RBAC.
  await requireCustomer();

  const body = {
    name: String(formData.get("name") ?? "").trim(),
    eventType: String(formData.get("eventType") ?? "WEDDING"),
    eventDate: String(formData.get("eventDate") ?? ""),
    eventTime: String(formData.get("eventTime") ?? "") || undefined,
    location: String(formData.get("location") ?? "").trim(),
    city: String(formData.get("city") ?? "Surabaya"),
    guestCount: String(formData.get("guestCount") ?? ""),
    budgetMin: formData.get("budgetMin") || undefined,
    budgetMax: formData.get("budgetMax") || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    ...pinFrom(formData),
  };

  let created: { id: string };
  try {
    created = await apiPost<{ id: string }>("/api/v1/events", body);
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Data acara tidak valid. Coba lagi.";
    redirect(`/events/new?error=${encodeURIComponent(message)}`);
  }
  redirect(`/events/${created.id}`);
}
