import postgres from "postgres";
import {
  drizzle,
  type PostgresJsDatabase,
} from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * This module is server-only by convention. The runtime guard below prevents
 * an accidental browser import from ever creating a database client.
 */

export type Database = PostgresJsDatabase<typeof schema>;
export type DatabaseExecutor = Pick<
  Database,
  "select" | "insert" | "update" | "delete"
>;

let sqlClient: ReturnType<typeof postgres> | undefined;
let database: Database | undefined;
let activeDatabaseUrl: string | undefined;

export function getDatabaseUrl(): string | undefined {
  const value = process.env.DATABASE_URL?.trim();
  return value || undefined;
}

export function hasDatabaseUrl(): boolean {
  return getDatabaseUrl() !== undefined;
}

export function getDatabase(): Database {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required to initialize the PostgreSQL client.",
    );
  }

  if (typeof window !== "undefined") {
    throw new Error("The PostgreSQL client can only be initialized on the server.");
  }

  if (database && activeDatabaseUrl !== databaseUrl) {
    throw new Error(
      "DATABASE_URL cannot change after the PostgreSQL client is initialized.",
    );
  }

  if (!database) {
    sqlClient = postgres(databaseUrl, {
      idle_timeout: 20,
      max: 10,
    });
    database = drizzle(sqlClient, { schema });
    activeDatabaseUrl = databaseUrl;
  }

  return database;
}

export const getDb = getDatabase;

export async function closeDatabase(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
  }

  sqlClient = undefined;
  database = undefined;
  activeDatabaseUrl = undefined;
}
