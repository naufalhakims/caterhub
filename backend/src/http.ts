import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "./errors";

/** Envelope error konsisten: { error: { code, message, fields? } }. */
export type ApiErrorBody = {
  error: { code: string; message: string; fields?: Record<string, string[] | undefined> };
};

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string[] | undefined>,
) {
  const body: ApiErrorBody = { error: { code, message, ...(fields ? { fields } : {}) } };
  return res.status(status).json(body);
}

/** Bungkus handler async agar penolakan promise diteruskan ke error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response) {
  return sendError(res, 404, "NOT_FOUND", `Rute ${req.method} ${req.path} tidak ditemukan.`);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) return next(err);
  if (err instanceof ZodError) {
    return sendError(res, 400, "VALIDATION_ERROR", "Data tidak valid.", err.flatten().fieldErrors);
  }
  if (err instanceof ApiError) {
    return sendError(res, err.status, err.code, err.message, err.fields);
  }
  // Body JSON rusak / terlalu besar.
  if (typeof err === "object" && err && "type" in err && (err as { type?: string }).type === "entity.parse.failed") {
    return sendError(res, 400, "INVALID_JSON", "Body JSON tidak valid.");
  }
  if (typeof err === "object" && err && "type" in err && (err as { type?: string }).type === "entity.too.large") {
    return sendError(res, 413, "PAYLOAD_TOO_LARGE", "Ukuran permintaan terlalu besar.");
  }
  // Jangan bocorkan stack/detail internal ke klien.
  console.error("[api] unhandled error:", err);
  return sendError(res, 500, "INTERNAL_ERROR", "Terjadi kesalahan pada server.");
}
