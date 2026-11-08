import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler, sendError } from "../http";
import { ApiError } from "../errors";
import { zIdr } from "../lib/money";
import { parseDateOnly, todayDateOnly } from "../lib/date";
import {
  INGREDIENT_UNITS,
  aggregateProduction,
  menuCostPerPortion,
  packageCosting,
  type ProductionMenu,
  type ProductionOrder,
} from "../domain/costing";

/** Pesanan yang pasti diproduksi (sudah lunas) vs tentatif (menunggu bayar). */
/** Termasuk "Sedang diantar" agar pesanan yang sedang dikirim tetap terlihat di lembar hari itu. */
const CONFIRMED_STATUSES = ["PAID", "PREPARING", "READY", "DELIVERED"] as const;
const TENTATIVE_STATUSES = ["PAYMENT_PENDING", "CONFIRMED"] as const;

const ingredientSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(2, "Nama bahan minimal 2 karakter.").max(80),
  unit: z.enum(INGREDIENT_UNITS, { errorMap: () => ({ message: "Satuan harus kg, liter, atau pcs." }) }),
  pricePerUnit: zIdr,
});

const recipeSchema = z.object({
  lines: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        quantity: z.coerce.number().positive("Jumlah bahan harus lebih dari 0.").max(100_000),
      }),
    )
    .max(40),
});

const packageCostSchema = z.object({ otherCostPerPax: zIdr });

async function requireVendor(req: Request) {
  const vendor = await db.vendorProfile.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
  if (!vendor) throw new ApiError(400, "VENDOR_PROFILE_MISSING", "Profil vendor belum dibuat.");
  return vendor;
}

const RECIPE_INCLUDE = {
  recipe: {
    include: { ingredient: { select: { name: true, unit: true, pricePerUnit: true } } },
    orderBy: { quantity: "desc" as const },
  },
};

/** Dapur: bahan baku, resep per menu, HPP paket, dan lembar produksi harian. */
export function kitchenRouter() {
  const router = Router();
  router.use(requireAuth, requireRole("VENDOR"));

  // ---------- Bahan baku ----------
  router.get(
    "/ingredients",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const rows = await db.ingredient.findMany({
        where: { vendorId: vendor.id },
        include: { _count: { select: { recipes: true } } },
        orderBy: { name: "asc" },
      });
      res.json({ data: rows });
    }),
  );

  router.post(
    "/ingredients",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const input = ingredientSchema.parse(req.body ?? {});
      if (input.id) {
        const existing = await db.ingredient.findUnique({ where: { id: input.id } });
        if (!existing || existing.vendorId !== vendor.id) throw new ApiError(403, "FORBIDDEN", "Akses ditolak.");
      }
      const duplicate = await db.ingredient.findFirst({
        where: { vendorId: vendor.id, name: { equals: input.name, mode: "insensitive" }, NOT: input.id ? { id: input.id } : undefined },
      });
      if (duplicate) return sendError(res, 409, "DUPLICATE_INGREDIENT", `Bahan "${input.name}" sudah ada.`);

      const data = { name: input.name, unit: input.unit, pricePerUnit: input.pricePerUnit };
      const saved = input.id
        ? await db.ingredient.update({ where: { id: input.id }, data })
        : await db.ingredient.create({ data: { vendorId: vendor.id, ...data } });
      res.json({ data: saved });
    }),
  );

  router.delete(
    "/ingredients/:id",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const existing = await db.ingredient.findUnique({ where: { id: req.params.id } });
      if (!existing || existing.vendorId !== vendor.id) throw new ApiError(403, "FORBIDDEN", "Akses ditolak.");
      await db.ingredient.delete({ where: { id: existing.id } });
      res.status(204).end();
    }),
  );

  // ---------- Resep per menu ----------
  router.put(
    "/menu/:id/recipe",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const input = recipeSchema.parse(req.body ?? {});
      const menu = await db.menuItem.findUnique({ where: { id: req.params.id }, select: { id: true, vendorId: true } });
      if (!menu || menu.vendorId !== vendor.id) throw new ApiError(403, "FORBIDDEN", "Akses ditolak.");

      // Gabungkan baris bahan yang sama agar tidak melanggar primary key.
      const merged = new Map<string, number>();
      for (const l of input.lines) merged.set(l.ingredientId, (merged.get(l.ingredientId) ?? 0) + l.quantity);
      const ids = [...merged.keys()];
      if (ids.length) {
        const owned = await db.ingredient.count({ where: { id: { in: ids }, vendorId: vendor.id } });
        if (owned !== ids.length) throw new ApiError(400, "INVALID_INGREDIENT", "Bahan tidak valid.");
      }

      await db.$transaction([
        db.menuItemIngredient.deleteMany({ where: { menuItemId: menu.id } }),
        db.menuItemIngredient.createMany({
          data: ids.map((ingredientId) => ({ menuItemId: menu.id, ingredientId, quantity: merged.get(ingredientId)! })),
        }),
      ]);
      res.json({ data: { ok: true, lines: ids.length } });
    }),
  );

  // ---------- HPP ----------
  router.get(
    "/costing",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const [ingredients, menus, packages] = await Promise.all([
        db.ingredient.findMany({ where: { vendorId: vendor.id }, orderBy: { name: "asc" } }),
        db.menuItem.findMany({
          where: { vendorId: vendor.id },
          include: RECIPE_INCLUDE,
          orderBy: [{ category: "asc" }, { name: "asc" }],
        }),
        db.package.findMany({
          where: { vendorId: vendor.id },
          include: { items: { select: { menuItemId: true } } },
          orderBy: { pricePerPax: "asc" },
        }),
      ]);

      const menuCost = new Map(menus.map((m) => [m.id, menuCostPerPortion(m.recipe)]));
      const menuName = new Map(menus.map((m) => [m.id, m.name]));
      const noRecipe = new Set(menus.filter((m) => m.recipe.length === 0).map((m) => m.id));

      res.json({
        data: {
          ingredients,
          menus: menus.map((m) => ({
            id: m.id,
            name: m.name,
            category: m.category,
            price: m.price,
            isAvailable: m.isAvailable,
            recipe: m.recipe.map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity, ingredient: r.ingredient })),
            costPerPortion: Math.round(menuCost.get(m.id) ?? 0),
          })),
          packages: packages.map((p) => {
            const menuIds = p.items.map((i) => i.menuItemId);
            return {
              id: p.id,
              name: p.name,
              pricePerPax: p.pricePerPax,
              otherCostPerPax: p.otherCostPerPax,
              isActive: p.isActive,
              menus: menuIds.map((id) => ({ id, name: menuName.get(id) ?? "?", cost: Math.round(menuCost.get(id) ?? 0) })),
              missingRecipes: menuIds.filter((id) => noRecipe.has(id)).map((id) => menuName.get(id) ?? "?"),
              costing: packageCosting({
                pricePerPax: p.pricePerPax,
                otherCostPerPax: p.otherCostPerPax,
                menuCosts: menuIds.map((id) => menuCost.get(id) ?? 0),
              }),
            };
          }),
        },
      });
    }),
  );

  router.patch(
    "/packages/:id/cost",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      const input = packageCostSchema.parse(req.body ?? {});
      const pkg = await db.package.findUnique({ where: { id: req.params.id }, select: { id: true, vendorId: true } });
      if (!pkg || pkg.vendorId !== vendor.id) throw new ApiError(403, "FORBIDDEN", "Akses ditolak.");
      const saved = await db.package.update({ where: { id: pkg.id }, data: { otherCostPerPax: input.otherCostPerPax } });
      res.json({ data: saved });
    }),
  );

  // ---------- Lembar produksi ----------
  router.get(
    "/production",
    asyncHandler(async (req, res) => {
      const vendor = await requireVendor(req);
      let day: Date;
      try {
        day = typeof req.query.date === "string" && req.query.date ? parseDateOnly(req.query.date) : todayDateOnly();
      } catch {
        return sendError(res, 400, "INVALID_DATE", "Tanggal tidak valid.");
      }

      const [bookings, menus, upcoming] = await Promise.all([
        db.booking.findMany({
          where: {
            vendorId: vendor.id,
            status: { in: [...CONFIRMED_STATUSES, ...TENTATIVE_STATUSES] },
            event: { eventDate: day },
          },
          include: {
            event: { select: { name: true, eventTime: true, guestCount: true, location: true, city: true } },
            customer: { select: { name: true, phone: true } },
            quotation: {
              select: {
                id: true,
                package: { select: { name: true, items: { select: { menuItemId: true } } } },
                items: { select: { name: true, quantity: true, menuItemId: true } },
              },
            },
          },
          orderBy: { event: { eventTime: "asc" } },
        }),
        db.menuItem.findMany({ where: { vendorId: vendor.id }, include: RECIPE_INCLUDE }),
        db.booking.groupBy({
          by: ["eventId"],
          where: {
            vendorId: vendor.id,
            status: { in: [...CONFIRMED_STATUSES, ...TENTATIVE_STATUSES] },
            event: { eventDate: { gte: todayDateOnly() } },
          },
        }),
      ]);

      const productionMenus: ProductionMenu[] = menus.map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        recipe: m.recipe.map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity, ingredient: r.ingredient })),
      }));

      const toOrder = (b: (typeof bookings)[number]): ProductionOrder => ({
        guests: b.event.guestCount,
        packageMenuIds: b.quotation.package?.items.map((i) => i.menuItemId) ?? [],
        linkedItems: b.quotation.items.flatMap((i) => (i.menuItemId ? [{ menuItemId: i.menuItemId, quantity: i.quantity }] : [])),
      });
      const toRow = (b: (typeof bookings)[number]) => ({
        id: b.id,
        status: b.status,
        eventName: b.event.name,
        eventTime: b.event.eventTime,
        guests: b.event.guestCount,
        location: `${b.event.location}, ${b.event.city}`,
        customerName: b.source === "OFFLINE" ? b.offlineCustomerName : b.customer.name,
        customerPhone: b.source === "OFFLINE" ? b.offlineCustomerPhone : b.customer.phone,
        source: b.source,
        packageName: b.quotation.package?.name ?? null,
        extras: b.quotation.items.filter((i) => i.menuItemId).map((i) => i.name),
      });

      const confirmed = bookings.filter((b) => (CONFIRMED_STATUSES as readonly string[]).includes(b.status));
      const tentative = bookings.filter((b) => (TENTATIVE_STATUSES as readonly string[]).includes(b.status));

      // Tanggal acara mendatang yang punya pesanan, untuk navigasi cepat.
      const events = upcoming.length
        ? await db.event.findMany({
            where: { id: { in: upcoming.map((u) => u.eventId) } },
            select: { eventDate: true },
          })
        : [];
      const upcomingDates = [...new Set(events.map((e) => e.eventDate.toISOString().slice(0, 10)))].sort().slice(0, 10);

      res.json({
        data: {
          date: day.toISOString().slice(0, 10),
          upcomingDates,
          confirmed: {
            orders: confirmed.map(toRow),
            guests: confirmed.reduce((s, b) => s + b.event.guestCount, 0),
            summary: aggregateProduction(confirmed.map(toOrder), productionMenus),
          },
          tentative: {
            orders: tentative.map(toRow),
            guests: tentative.reduce((s, b) => s + b.event.guestCount, 0),
            summary: aggregateProduction(tentative.map(toOrder), productionMenus),
          },
        },
      });
    }),
  );

  return router;
}
