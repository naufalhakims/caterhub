import { PrismaClient } from "@prisma/client";
import { env } from "./env";

export const db = new PrismaClient({
  datasources: { db: { url: env.databaseUrl } },
});
