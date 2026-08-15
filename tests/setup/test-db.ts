import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const databaseUrl = process.env.TEST_DB_URL ?? process.env.DB_URL!;

if (!databaseUrl) {
    throw new Error("TEST_DB_URL is not defined");
}

export const testClient = postgres(databaseUrl, {
    max: 1
});

export const testDb = drizzle(testClient);
