import { sql } from "drizzle-orm";

import { testDb } from "./test-db.js";

export async function cleanTestDatabase(): Promise<void> {
    await testDb.execute(sql`TRUNCATE TABLE logs CASCADE`);
}
