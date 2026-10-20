import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations";

// Cegah deploy produksi dengan secret contoh (nilai di .env.example / .env lokal).
// Saat `next build` fase ini dilewati agar build tidak butuh secret produksi;
// validasi tetap berjalan saat server benar-benar start.
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32 || /ganti|changeme|secret-random|example/i.test(secret)) {
    throw new Error(
      "AUTH_SECRET belum aman: gunakan nilai acak minimal 32 karakter (mis. `openssl rand -base64 32`).",
    );
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const parsed = loginSchema.safeParse(creds);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({
          where: { email: parsed.data.email.trim().toLowerCase() },
        });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // ponytail: role fetched from DB on each jwt refresh if roles change mid-session; upgrade when admin role edits needed live.
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
});
