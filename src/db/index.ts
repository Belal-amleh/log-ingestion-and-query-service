// process.loadEnvFile();
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
console.log("TEST_DB_URL:", process.env.TEST_DB_URL);
console.log("DB_URL:", process.env.DB_URL);

const databaseUrl = process.env.TEST_DB_URL ?? process.env.DB_URL!;

const url = new URL(databaseUrl);

console.log("ACTUAL DB:", {
    user: url.username,
    host: url.hostname,
    port: url.port,
    database: url.pathname
});

const client = postgres(databaseUrl, {
    max: 10
});

export const db = drizzle(client);
