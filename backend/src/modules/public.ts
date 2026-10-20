import { Router } from "express";
import { z } from "zod";
import { asyncHandler, sendError } from "../http";
import { checkCapacity } from "../domain/capacity";

const querySchema = z.object({
  vendorId: z.string().min(1),
  date: z.string().min(1),
  guests: z.coerce.number().int().min(1),
});

/** Endpoint publik: pratinjau kapasitas vendor pada tanggal tertentu. */
export function publicRouter() {
  const router = Router();

  router.get(
    "/capacity",
    asyncHandler(async (req, res) => {
      const q = querySchema.safeParse(req.query);
      if (!q.success) return sendError(res, 400, "VALIDATION_ERROR", "Parameter tidak valid.");
      try {
        const result = await checkCapacity(q.data.vendorId, q.data.date, q.data.guests);
        res.json({ data: result });
      } catch {
        return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor tidak ditemukan.");
      }
    }),
  );

  return router;
}
