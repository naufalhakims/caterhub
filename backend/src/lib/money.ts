import { z } from "zod";

export function parseIDR(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.trunc(input) : null;
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const negative = trimmed.startsWith("-");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

const idrNumber = z
  .number({ invalid_type_error: "Nominal tidak valid.", required_error: "Nominal wajib diisi." })
  .int("Nominal harus bilangan bulat.")
  .min(0, "Nominal tidak boleh negatif.");

const toIdr = (v: unknown) => (v === "" || v == null ? undefined : (parseIDR(v) ?? Number.NaN));

export const zIdr = z.preprocess(toIdr, idrNumber);
export const zIdrOptional = z.preprocess(toIdr, idrNumber.optional());
export function zIdrWithDefault(fallback = 0) {
  return z.preprocess(toIdr, idrNumber.default(fallback));
}
