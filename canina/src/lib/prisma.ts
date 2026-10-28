import { cache } from "react";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: isWorkers ? 1 : 10 }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * En Cloudflare Workers una conexión TCP no puede reutilizarse entre peticiones,
 * así que se crea un cliente por petición (React `cache`). En Node se mantiene
 * un único cliente con pool de conexiones.
 */
const isWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const requestClient = cache(createClient);

function current(): PrismaClient {
  if (isWorkers) return requestClient();
  return (globalForPrisma.prisma ??= createClient());
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const client = current();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** Cliente de transacción interactiva de Prisma */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export type Db = PrismaClient | Tx;
