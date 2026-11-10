import Link from "next/link";
import { registerAction } from "@/server/auth-actions";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Field, Input, Select } from "@/components/ui/Field";

export default function RegisterPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  return (
    <Card className="animate-rise w-full !border-0 !p-0 sm:!p-2">
      <h1 className="font-display text-5xl text-ink">Buat <em>akun</em> baru</h1>
      <p className="mt-3 text-[15px] text-stone-500">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Masuk
        </Link>
      </p>
      {searchParams?.error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          {searchParams.error}
        </p>
      )}
      <form action={registerAction} className="mt-6 space-y-4">
        <Field label="Nama / Nama Usaha">
          <Input name="name" required placeholder="cth. Budi Santoso" autoComplete="name" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required placeholder="nama@email.com" autoComplete="email" />
        </Field>
        <Field label="Kata Sandi">
          <Input name="password" type="password" required minLength={8} placeholder="Minimal 8 karakter" autoComplete="new-password" />
        </Field>
        <Field label="Daftar sebagai">
          <Select name="role" defaultValue="CUSTOMER">
            <option value="CUSTOMER">Pelanggan (cari & pesan catering)</option>
            <option value="VENDOR">Vendor (kelola usaha catering)</option>
          </Select>
        </Field>
        <SubmitButton arrow className="w-full !py-3 !text-base">
          Buat Akun
        </SubmitButton>
      </form>
      <p className="mt-4 text-center text-xs text-stone-400">
        Vendor baru diverifikasi admin sebelum bisa menerima pesanan.
      </p>
    </Card>
  );
}
