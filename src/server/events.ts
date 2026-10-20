"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth-helpers";
import { eventSchema } from "@/lib/validations";

export async function createEventAction(formData: FormData) {
  // Hanya pelanggan yang boleh membuat acara; vendor/admin dialihkan ke berandanya.
  const user = await requireCustomer();
  const parsed = eventSchema.safeParse({
    name: formData.get("name"),
    eventType: formData.get("eventType"),
    eventDate: formData.get("eventDate"),
    eventTime: formData.get("eventTime") || undefined,
    location: formData.get("location"),
    city: formData.get("city") || "Surabaya",
    guestCount: formData.get("guestCount"),
    budgetMin: formData.get("budgetMin") || undefined,
    budgetMax: formData.get("budgetMax") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    const params = new URLSearchParams({
      error: parsed.error.issues[0]?.message ?? "Data acara tidak valid.",
    });
    redirect(`/events/new?${params}`);
  }
  const event = await db.event.create({
    data: { customerId: user.id, ...parsed.data },
  });
  redirect(`/events/${event.id}`);
}
