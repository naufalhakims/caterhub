export type Role = "CUSTOMER" | "VENDOR" | "ADMIN";

export type AccessUser = { id: string; role: Role | string };
export type VendorOwned = { vendorUserId: string };
export type CustomerOwned = { customerId: string };

export function isAdmin(user: AccessUser): boolean {
  return user.role === "ADMIN";
}

function isParty(user: AccessUser, customerId: string, vendorUserId: string): boolean {
  return user.id === customerId || user.id === vendorUserId;
}

/** Admin boleh meninjau; selain itu hanya pihak terkait. */
export function canViewQuotation(user: AccessUser, q: CustomerOwned & VendorOwned): boolean {
  return isAdmin(user) || isParty(user, q.customerId, q.vendorUserId);
}

export function canViewBooking(user: AccessUser, b: CustomerOwned & VendorOwned): boolean {
  return isAdmin(user) || isParty(user, b.customerId, b.vendorUserId);
}

export function canViewPayment(user: AccessUser, p: CustomerOwned): boolean {
  return isAdmin(user) || user.id === p.customerId;
}

/** Chat privat: hanya customer & vendor pemilik penawaran. Admin tidak ikut. */
export function isOfferParty(user: AccessUser, q: CustomerOwned & VendorOwned): boolean {
  return isParty(user, q.customerId, q.vendorUserId);
}
