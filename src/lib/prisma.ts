import type { PrismaClient } from "@prisma/client";
import { createDb } from "@/lib/demo-db";

const globalForDemo = globalThis as unknown as {
  siruDemoDb?: ReturnType<typeof createDb>;
};

const demoDb = globalForDemo.siruDemoDb ?? createDb();
globalForDemo.siruDemoDb = demoDb;

export const prisma = demoDb as unknown as PrismaClient;
