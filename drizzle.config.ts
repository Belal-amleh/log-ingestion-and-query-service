import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  process.loadEnvFile();
}
const dbURL = process.env.DB_URL;

if (!dbURL) {
  throw new Error("DATABASE URL is not defined");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",

  dbCredentials: {
    url: dbURL,
  },

  strict: true,
  verbose: true,
});