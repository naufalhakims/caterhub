export type QuoteLine = { quantity: number; unitPrice: number };

export function calcTotals(items: QuoteLine[], deliveryFee = 0, serviceFee = 0, discount = 0) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const total = Math.max(0, subtotal + deliveryFee + serviceFee - discount);
  return { subtotal, total };
}
