import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { testDb } from "../setup/test-db.js";

describe("Database migrations", () => {
    it("creates the logs table", async () => {
        const result = await testDb.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'logs'
      ) AS exists
    `);

        expect(result[0]?.exists).toBe(true);
    });

    it("creates the log_level enum", async () => {
        const result = await testDb.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'log_level'
      ) AS exists
    `);

        expect(result[0]?.exists).toBe(true);
    });
});
