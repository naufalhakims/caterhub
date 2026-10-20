import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { RupiahInput } from "@/components/ui/RupiahInput";
import { createEventAction } from "@/server/events";
import { requireCustomer } from "@/lib/auth-helpers";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  await requireCustomer();
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-stone-500"><Link href="/dashboard" className="hover:text-brand-700 hover:underline">← Dashboard</Link></p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Ceritakan acaramu</h1>
        <p className="mt-1 text-sm text-stone-500">Satu formulir — kami carikan vendor yang muat tanggal, pax, dan budget.</p>
        {searchParams?.error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{searchParams.error}</p>
        )}
        <Card className="mt-5">
          <form action={createEventAction} className="space-y-4">
            <Field label="Nama acara">
              <Input name="name" required placeholder="cth. Pernikahan Budi & Sari" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipe acara">
                <Select name="eventType" defaultValue="WEDDING">
                  <option value="WEDDING">Pernikahan</option>
                  <option value="BIRTHDAY">Ulang tahun</option>
                  <option value="CORPORATE">Korporat</option>
                  <option value="MEETING">Rapat</option>
                  <option value="SEMINAR">Seminar</option>
                  <option value="GATHERING">Gathering</option>
                  <option value="GRADUATION">Wisuda</option>
                  <option value="OTHER">Lainnya</option>
                </Select>
              </Field>
              <Field label="Jumlah tamu (pax)">
                <Input name="guestCount" type="number" min={10} required placeholder="250" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tanggal acara">
                <Input name="eventDate" type="date" required />
              </Field>
              <Field label="Waktu (opsional)">
                <Input name="eventTime" placeholder="cth. 10.00–14.00" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Lokasi">
                <Input name="location" required placeholder="cth. Gedung Sasono Utomo" />
              </Field>
              <Field label="Kota">
                <Select name="city" defaultValue="Surabaya">
                  <option>Surabaya</option>
                  <option>Sidoarjo</option>
                  <option>Gresik</option>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Budget min (Rp, opsional)">
                <RupiahInput name="budgetMin" placeholder="7.000.000" />
              </Field>
              <Field label="Budget maks (Rp, opsional)">
                <RupiahInput name="budgetMax" placeholder="10.000.000" />
              </Field>
            </div>
            <Field label="Catatan (opsional)">
              <Textarea name="notes" rows={3} placeholder="Pantangan makanan, tema, kebutuhan khusus…" />
            </Field>
            <SubmitButton className="w-full !py-2.5">Simpan & cari catering →</SubmitButton>
          </form>
        </Card>
      </main>
    </>
  );
}
