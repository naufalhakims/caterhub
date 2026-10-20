import type { QuotationOrigin, QuotationStatus } from "@prisma/client";

/**
 * Aturan transisi status penawaran (dua asal penawaran).
 *  - CUSTOMER_REQUEST: mulai REQUESTED; vendor memutuskan SENT atau DECLINED.
 *  - VENDOR_OFFER: mulai SENT.
 * Chat tidak pernah mengubah status.
 */
export const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ["REQUESTED", "SENT", "EXPIRED"],
  REQUESTED: ["SENT", "DECLINED", "EXPIRED"],
  SENT: ["REVISION_REQUESTED", "ACCEPTED", "REJECTED", "EXPIRED"],
  REVISION_REQUESTED: ["SENT", "ACCEPTED", "REJECTED", "EXPIRED"],
  ACCEPTED: [],
  REJECTED: [],
  DECLINED: [],
  EXPIRED: [],
};

export function canTransitionQuotation(from: QuotationStatus, to: QuotationStatus): boolean {
  return QUOTATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertQuotationTransition(from: QuotationStatus, to: QuotationStatus): void {
  if (!canTransitionQuotation(from, to)) {
    throw new Error(`Transisi penawaran tidak valid: ${from} → ${to}.`);
  }
}

export type QuotationActor = "CUSTOMER" | "VENDOR" | "ADMIN";

export type QuotationDecision =
  | "send_offer"
  | "decline_request"
  | "accept"
  | "reject"
  | "request_revision";

const DECISION_RULES: Record<
  QuotationDecision,
  { actor: QuotationActor; origin: QuotationOrigin | null; from: QuotationStatus[]; to: QuotationStatus }
> = {
  send_offer: { actor: "VENDOR", origin: "CUSTOMER_REQUEST", from: ["REQUESTED"], to: "SENT" },
  decline_request: { actor: "VENDOR", origin: "CUSTOMER_REQUEST", from: ["REQUESTED"], to: "DECLINED" },
  accept: { actor: "CUSTOMER", origin: null, from: ["SENT", "REVISION_REQUESTED"], to: "ACCEPTED" },
  reject: { actor: "CUSTOMER", origin: null, from: ["SENT", "REVISION_REQUESTED"], to: "REJECTED" },
  request_revision: {
    actor: "CUSTOMER",
    origin: null,
    from: ["SENT", "REVISION_REQUESTED"],
    to: "REVISION_REQUESTED",
  },
};

export function canPerformQuotationDecision(input: {
  decision: QuotationDecision;
  actorRole: QuotationActor;
  origin: QuotationOrigin;
  status: QuotationStatus;
}): boolean {
  const rule = DECISION_RULES[input.decision];
  if (!rule) return false;
  if (input.actorRole !== rule.actor) return false;
  if (rule.origin && input.origin !== rule.origin) return false;
  return rule.from.includes(input.status);
}

export function nextQuotationStatus(decision: QuotationDecision): QuotationStatus {
  return DECISION_RULES[decision].to;
}

export const QUOTATION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  REQUESTED: "Permintaan Baru",
  SENT: "Penawaran Terkirim",
  REVISION_REQUESTED: "Minta Revisi",
  ACCEPTED: "Diterima",
  REJECTED: "Ditolak Pelanggan",
  DECLINED: "Ditolak Vendor",
  EXPIRED: "Kedaluwarsa",
};

export const QUOTATION_ORIGIN_LABEL: Record<string, string> = {
  CUSTOMER_REQUEST: "Permintaan pelanggan",
  VENDOR_OFFER: "Penawaran vendor",
};
