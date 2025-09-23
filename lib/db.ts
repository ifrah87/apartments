//lib/db.ts
import { PrismaClient } from "@prisma/client";

//Prevent creting new PrismaClient on hot-reload in dev
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: ["query", "error", "warn"], // logs SQL + warnings to your terminal
    });

    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;