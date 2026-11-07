export type QuoteLine = { quantity: number; unitPrice: number };

export function calcTotals(items: QuoteLine[], deliveryFee = 0, serviceFee = 0, discount = 0) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const total = Math.max(0, subtotal + deliveryFee + serviceFee - discount);
  return { subtotal, total };
}

export type RequestItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  /** Menu sumber untuk lembar produksi (menu tambahan). */
  menuItemId?: string;
};

/**
 * Baris nota awal permintaan pelanggan: paket × jumlah tamu, lalu setiap menu
 * tambahan (harga add-on per pax) × jumlah tamu. Nama di-snapshot agar harga
 * historis tidak berubah bila vendor mengedit menu.
 */
export function buildRequestItems(
  pkg: { name: string; pricePerPax: number },
  addOns: { id?: string; name: string; price: number }[],
  guests: number,
): RequestItem[] {
  const line = (name: string, unitPrice: number, menuItemId?: string): RequestItem => ({
    name,
    quantity: guests,
    unitPrice,
    subtotal: unitPrice * guests,
    ...(menuItemId ? { menuItemId } : {}),
  });
  return [
    line(`Paket ${pkg.name} (${guests} pax)`, pkg.pricePerPax),
    ...addOns.map((a) => line(`Tambahan: ${a.name}`, a.price, a.id)),
  ];
}
