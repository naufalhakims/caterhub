import { roleHome, type Role } from "@/lib/roles";

export type AccessUser = { id: string; role: Role | string };

export type VendorOwned = { vendorUserId: string };
export type CustomerOwned = { customerId: string };

export { roleHome };

export function isAdmin(user: AccessUser): boolean {
  return user.role === "ADMIN";
}

function isParty(user: AccessUser, customerId: string, vendorUserId: string): boolean {
  return user.id === customerId || user.id === vendorUserId;
}

/** Admin boleh meninjau (monitoring); selain itu hanya pihak terkait. */
export function canViewQuotation(user: AccessUser, q: CustomerOwned & VendorOwned): boolean {
  return isAdmin(user) || isParty(user, q.customerId, q.vendorUserId);
}

export function canViewBooking(user: AccessUser, b: CustomerOwned & VendorOwned): boolean {
  return isAdmin(user) || isParty(user, b.customerId, b.vendorUserId);
}

export function canViewPayment(user: AccessUser, p: CustomerOwned): boolean {
  return isAdmin(user) || user.id === p.customerId;
}

/**
 * Chat penawaran hanya untuk pelanggan & vendor pada penawaran tersebut.
 * Admin TIDAK termasuk (hanya boleh bila dimoderasi secara eksplisit, saat ini tidak ada).
 */
export function isOfferParty(user: AccessUser, q: CustomerOwned & VendorOwned): boolean {
  return isParty(user, q.customerId, q.vendorUserId);
}

/** Vendor hanya boleh mengelola profilnya sendiri. */
export function canManageVendor(user: AccessUser, vendor: { userId: string }): boolean {
  return user.role === "VENDOR" && vendor.userId === user.id;
}
