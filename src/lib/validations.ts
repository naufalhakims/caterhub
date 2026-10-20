import { z } from "zod";
import { toDateOnly } from "@/lib/date";
import { zIdrOptional } from "@/lib/money";

/** Menerima "YYYY-MM-DD" atau Date dan menormalkannya ke UTC tengah malam. */
export const dateOnlySchema = z
  .union([z.string(), z.date()])
  .transform((v, ctx) => {
    try {
      return toDateOnly(v);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tanggal tidak valid." });
      return z.NEVER;
    }
  });

export const registerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter."),
  email: z.string().email("Email tidak valid."),
  password: z.string().min(6, "Kata sandi minimal 6 karakter."),
  role: z.enum(["CUSTOMER", "VENDOR"]).default("CUSTOMER"),
});

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

export const eventSchema = z
  .object({
    name: z.string().min(3, "Nama acara minimal 3 karakter."),
    eventType: z.enum([
      "WEDDING",
      "BIRTHDAY",
      "CORPORATE",
      "MEETING",
      "SEMINAR",
      "GATHERING",
      "GRADUATION",
      "OTHER",
    ]),
    eventDate: dateOnlySchema,
    eventTime: z.string().optional(),
    location: z.string().min(3, "Lokasi wajib diisi."),
    city: z.string().default("Surabaya"),
    guestCount: z.coerce.number().int().min(10, "Minimal 10 pax.").max(100000, "Jumlah pax tidak wajar."),
    budgetMin: zIdrOptional,
    budgetMax: zIdrOptional,
    notes: z.string().optional(),
  })
  .refine(
    (v) => v.budgetMin == null || v.budgetMax == null || v.budgetMin <= v.budgetMax,
    { message: "Budget minimum tidak boleh lebih besar dari budget maksimum.", path: ["budgetMax"] },
  );

export const quotationRequestSchema = z.object({
  eventId: z.string().cuid(),
  packageId: z.string().cuid(),
  notes: z.string().optional(),
});

export const quotationCreateSchema = z.object({
  eventId: z.string().cuid(),
  customerId: z.string().cuid(),
  packageId: z.string().cuid().optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        quantity: z.coerce.number().int().min(1),
        unitPrice: z.coerce.number().int().min(0),
      })
    )
    .min(1, "Minimal 1 item."),
  deliveryFee: z.coerce.number().int().min(0).default(0),
  serviceFee: z.coerce.number().int().min(0).default(0),
  discount: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional(),
  expiresAt: z.coerce.date().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EventInput = z.infer<typeof eventSchema>;
