import { Card } from "@/components/ui/Card";
import { FormButton } from "@/components/ui/FormButton";
import { setWhatsAppOptInAction } from "@/server/whatsapp-actions";

/** Sama dengan normalizeIndonesianPhone di backend (validasi tampilan saja). */
function isValidWhatsApp(raw: string | null) {
  if (!raw) return false;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("62")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return /^8\d{8,11}$/.test(d);
}

/**
 * Pengaturan notifikasi WhatsApp: status, nomor yang dipakai, dan tombol
 * aktif/nonaktif. Hanya event penting yang dikirim ke WhatsApp.
 */
export function WhatsAppSettings({
  optIn,
  phone,
  returnTo,
  events,
}: {
  optIn: boolean;
  phone: string | null;
  returnTo: string;
  events: string;
}) {
  const valid = isValidWhatsApp(phone);
  const active = optIn && valid;
  return (
    <Card className="mt-4 !p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <h2 className="font-display text-2xl text-ink">
            Notifikasi <em>WhatsApp</em>
          </h2>
          <p className="mt-1 text-sm text-stone-600">{events}</p>
          <p className="mt-2 text-sm">
            <span
              className={`mr-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-stone-400"}`} />
              {active ? "Aktif" : optIn ? "Belum aktif" : "Dimatikan"}
            </span>
            {phone ? (
              <span className={valid ? "text-stone-700" : "text-red-700"}>
                {phone}
                {!valid && " — nomor tidak valid, gunakan nomor seluler (08…)."}
              </span>
            ) : (
              <span className="text-stone-500">Isi nomor telepon di formulir profil agar pesan bisa terkirim.</span>
            )}
          </p>
        </div>
        <form action={setWhatsAppOptInAction}>
          <input type="hidden" name="optIn" value={optIn ? "false" : "true"} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <FormButton variant={optIn ? "secondary" : "primary"} pendingLabel="Menyimpan…">
            {optIn ? "Matikan" : "Aktifkan"}
          </FormButton>
        </form>
      </div>
    </Card>
  );
}
