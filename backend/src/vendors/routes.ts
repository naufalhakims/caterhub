import { Router } from "express";
import { asyncHandler, sendError } from "../http";
import type { VendorRepository } from "./dto";
import { parseSearchFilters } from "./filters";

export function vendorsRouter(repo: VendorRepository) {
  const router = Router();

  // GET /api/v1/vendors?q=&city=&date=YYYY-MM-DD&guests=&budgetMax=
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const filters = parseSearchFilters(req.query as Record<string, unknown>);
      const data = await repo.search(filters);
      res.json({
        data,
        meta: {
          count: data.length,
          filters,
        },
      });
    }),
  );

  // GET /api/v1/vendors/:id
  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const vendor = await repo.getById(req.params.id);
      if (!vendor) {
        return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor tidak ditemukan atau belum terverifikasi.");
      }
      res.json({ data: vendor });
    }),
  );

  return router;
}
