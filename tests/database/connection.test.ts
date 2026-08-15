import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { testDb } from "../setup/test-db.js";

describe("Test database connection", () => {
    it("connects to liqs_test", async () => {
        const result = await testDb.execute(sql`SELECT current_database() AS database`);

        expect(result[0]?.database).toBe("liqs_test");
    });
});
