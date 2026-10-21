export type QuotationOrigin = "CUSTOMER_REQUEST" | "VENDOR_OFFER";
export type QuotationStatus =
  | "DRAFT"
  | "REQUESTED"
  | "SENT"
  | "REVISION_REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "DECLINED"
  | "EXPIRED";

/**
 * Aturan transisi status permintaan/penawaran.
 *
 *  - CUSTOMER_REQUEST: pelanggan mengirim permintaan pesanan (status awal REQUESTED).
 *    Vendor mengonfirmasi (ACCEPTED) atau menolak (DECLINED).
 *  - VENDOR_OFFER: alur lama, vendor mengirim penawaran langsung (status awal SENT).
 *
 * Chat TIDAK pernah mengubah status.
 */
export const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ["REQUESTED", "SENT", "EXPIRED"],
  REQUESTED: ["SENT", "ACCEPTED", "DECLINED", "EXPIRED"],
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
  | "confirm_request"
  | "decline_request"
  | "accept"
  | "reject"
  | "request_revision";

const DECISION_RULES: Record<
  QuotationDecision,
  { actor: QuotationActor; origin: QuotationOrigin | null; from: QuotationStatus[]; to: QuotationStatus }
> = {
  // Vendor menanggapi permintaan pelanggan.
  send_offer: {
    actor: "VENDOR",
    origin: "CUSTOMER_REQUEST",
    from: ["REQUESTED"],
    to: "SENT",
  },
  confirm_request: {
    actor: "VENDOR",
    origin: "CUSTOMER_REQUEST",
    from: ["REQUESTED"],
    to: "ACCEPTED",
  },
  decline_request: {
    actor: "VENDOR",
    origin: "CUSTOMER_REQUEST",
    from: ["REQUESTED"],
    to: "DECLINED",
  },
  // Keputusan pelanggan atas penawaran (dari vendor maupun hasil negosiasi permintaan).
  accept: {
    actor: "CUSTOMER",
    origin: null,
    from: ["SENT", "REVISION_REQUESTED"],
    to: "ACCEPTED",
  },
  reject: {
    actor: "CUSTOMER",
    origin: null,
    from: ["SENT", "REVISION_REQUESTED"],
    to: "REJECTED",
  },
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
  REQUESTED: "Menunggu Konfirmasi Vendor",
  SENT: "Penawaran Terkirim",
  REVISION_REQUESTED: "Minta Revisi",
  ACCEPTED: "Dikonfirmasi Vendor",
  REJECTED: "Ditolak Pelanggan",
  DECLINED: "Ditolak Vendor",
  EXPIRED: "Kedaluwarsa",
};

export const QUOTATION_ORIGIN_LABEL: Record<string, string> = {
  CUSTOMER_REQUEST: "Permintaan pelanggan",
  VENDOR_OFFER: "Penawaran vendor",
};
