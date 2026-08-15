// tests/global_setup.ts

import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { ensureLogsPartitions } from "../src/db/partitions.js";

export default async function globalSetup() {
    const databaseUrl = process.env.TEST_DB_URL ?? process.env.DB_URL!;

    if (!databaseUrl) {
        throw new Error("TEST_DB_URL is not defined. " + "Make sure .env.test exists and is loaded by Vitest.");
    }

    console.log("Initializing test database...");

    /*
     * Create a PostgreSQL client dedicated to the test database.
     *
     * max: 1 means this test client uses only one
     * PostgreSQL connection.
     */
    const client = postgres(databaseUrl, {
        max: 1
    });

    const db = drizzle(client);

    try {
        //1. Run all Drizzle migrations.

        console.log("Running database migrations...");

        await migrate(db, {
            migrationsFolder: "./src/db/migrations"
        });

        //2. Make sure the required time-based partitions exist.

        console.log("Initializing log partitions...");

        await ensureLogsPartitions(db);

        console.log("Test database initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize test database:", error);

        throw error;
    } finally {
        /*
         * The tests themselves will create/use their own
         * testDb connection from tests/setup/test-db.ts.
         */
        await client.end();
    }
}
