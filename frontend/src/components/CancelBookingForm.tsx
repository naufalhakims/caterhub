import { FormButton } from "@/components/ui/FormButton";
import { Textarea } from "@/components/ui/Field";
import { cancelBookingAction } from "@/server/booking-actions";

/**
 * Aksi destruktif = satu-satunya yang butuh konfirmasi. Panel terbuka dari
 * tombol pemicunya (bukan modal terpisah) dan wajib berisi alasan.
 */
export function CancelBookingForm({
  bookingId,
  returnTo,
  label = "Batalkan pesanan",
  consequence,
}: {
  bookingId: string;
  returnTo: string;
  label?: string;
  /** Penjelasan dampak pembatalan (refund, pelepasan jadwal, dsb). */
  consequence: string;
}) {
  return (
    <details className="group">
      <summary className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 group-open:bg-red-50">
        {label}
        <span aria-hidden className="transition-transform duration-300 ease-fluid group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <form
        action={cancelBookingAction}
        className="disclose-panel mt-2 space-y-2.5 rounded-2xl bg-red-50/60 p-4 ring-1 ring-inset ring-red-200"
      >
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <p className="text-[13px] leading-relaxed text-red-900">{consequence}</p>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-red-900">Alasan pembatalan</span>
          <Textarea
            name="reason"
            rows={2}
            required
            minLength={5}
            maxLength={500}
            placeholder="cth. Acara diundur ke bulan depan."
            className="!border-red-200 focus:!border-red-500 focus:!ring-red-100"
          />
        </label>
        <FormButton variant="danger" pendingLabel="Membatalkan…">
          Ya, batalkan
        </FormButton>
      </form>
    </details>
  );
}
