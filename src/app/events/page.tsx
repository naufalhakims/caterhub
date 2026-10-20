import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";

export default async function EventsIndex() {
  await requireUser();
  redirect("/dashboard");
}
