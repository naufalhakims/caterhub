import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { roleHome } from "@/lib/roles";

/** Arahkan pengguna yang sudah login ke beranda sesuai perannya. */
export async function redirectByRole() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  redirect(roleHome(role));
}
