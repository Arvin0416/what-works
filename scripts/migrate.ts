import { migrate } from "drizzle-orm/postgres-js/migrator";
import {
  closeDatabase,
  getDatabase,
  getDatabaseUrl,
} from "../lib/db/client";

async function main(): Promise<void> {
  if (!getDatabaseUrl()) {
    throw new Error(
      "DATABASE_URL is required to run database migrations. Generate migrations with `npm run db:generate` first.",
    );
  }

  try {
    await migrate(getDatabase(), { migrationsFolder: "./drizzle" });
  } finally {
    await closeDatabase();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
