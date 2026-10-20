// Query baca-saja. Tidak memakai "use server" agar tidak diekspos sebagai endpoint
// yang bisa dipanggil klien dengan customerId sembarang (IDOR).
import { db } from "@/lib/db";

export async function getCustomerEvents(customerId: string) {
  return db.event.findMany({
    where: { customerId },
    orderBy: { eventDate: "asc" },
    include: { quotations: true, bookings: true },
  });
}
