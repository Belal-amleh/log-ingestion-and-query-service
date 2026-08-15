import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { testDb } from "../setup/test-db.js";
import { createLogsPartition, ensureLogsPartitions } from "../../src/db/partitions.js";

function getMonthStart(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function getPartitionName(date: Date): string {
    const year = date.getUTCFullYear();

    const month = String(date.getUTCMonth() + 1).padStart(2, "0");

    return `logs_${year}_${month}`;
}

async function partitionExists(partitionName: string): Promise<boolean> {
    const result = await testDb.execute(sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_inherits
      WHERE inhparent = 'logs'::regclass
        AND inhrelid::regclass::text = ${partitionName}
    ) AS exists
  `);

    return result[0]?.exists === true;
}

describe("Logs table partitions", () => {
    it("logs table is partitioned by timestamp", async () => {
        const result = await testDb.execute(sql`
      SELECT pg_get_partkeydef('logs'::regclass) AS partition_key
    `);

        expect(result).toHaveLength(1);

        expect(result[0]?.partition_key).toContain(`RANGE ("timestamp")`);
    });

    it("logs table has partitions", async () => {
        const result = await testDb.execute(sql`
      SELECT
        inhrelid::regclass::text AS partition
      FROM pg_inherits
      WHERE inhparent = 'logs'::regclass
      ORDER BY partition
    `);

        expect(result.length).toBeGreaterThan(0);
    });

    it("monthly partitions use the correct naming convention", async () => {
        const result = await testDb.execute(sql`
      SELECT
        inhrelid::regclass::text AS partition
      FROM pg_inherits
      WHERE inhparent = 'logs'::regclass
    `);

        const partitions = result.map((row) => row.partition);

        const monthlyPartitions = partitions.filter((name) => /^logs_\d{4}_\d{2}$/.test(name));

        expect(monthlyPartitions.length).toBeGreaterThan(0);
    });

    it("August 2026 partition has the correct boundaries", async () => {
        const result = await testDb.execute(sql`
      SELECT
        c.relname AS partition,
        pg_get_expr(c.relpartbound, c.oid) AS partition_bound
      FROM pg_class c
      JOIN pg_inherits i
        ON i.inhrelid = c.oid
      WHERE i.inhparent = 'logs'::regclass
        AND c.relname = 'logs_2026_08'
    `);

        expect(result).toHaveLength(1);

        const bound = result[0]?.partition_bound;

        expect(bound).toContain("2026-08-01");
        expect(bound).toContain("2026-09-01");
    });

    it("createLogsPartition creates a missing monthly partition", async () => {
        const testDate = new Date("2030-05-15T12:00:00Z");

        const partitionName = getPartitionName(testDate);

        // Make sure the partition does not already exist.
        await testDb.execute(
            sql.raw(`
        DROP TABLE IF EXISTS "${partitionName}"
      `)
        );

        expect(await partitionExists(partitionName)).toBe(false);

        await createLogsPartition(testDb, testDate);

        expect(await partitionExists(partitionName)).toBe(true);

        // Clean up the partition created by this test.
        await testDb.execute(
            sql.raw(`
        DROP TABLE IF EXISTS "${partitionName}"
      `)
        );
    });

    it("createLogsPartition creates the correct monthly range", async () => {
        const testDate = new Date("2031-05-20T12:00:00Z");

        const partitionName = getPartitionName(testDate);

        await testDb.execute(
            sql.raw(`
        DROP TABLE IF EXISTS "${partitionName}"
      `)
        );

        await createLogsPartition(testDb, testDate);

        const result = await testDb.execute(sql`
      SELECT
        pg_get_expr(c.relpartbound, c.oid) AS partition_bound
      FROM pg_class c
      JOIN pg_inherits i
        ON i.inhrelid = c.oid
      WHERE i.inhparent = 'logs'::regclass
        AND c.relname = ${partitionName}
    `);

        expect(result).toHaveLength(1);

        const bound = result[0]?.partition_bound;

        expect(bound).toContain("2031-05-01");
        expect(bound).toContain("2031-06-01");

        await testDb.execute(
            sql.raw(`
        DROP TABLE IF EXISTS "${partitionName}"
      `)
        );
    });

    it("ensureLogsPartitions creates three consecutive monthly partitions", async () => {
        await ensureLogsPartitions(testDb);

        const now = new Date();

        const currentMonth = getMonthStart(now);

        const expectedPartitions: string[] = [];

        for (let i = 0; i < 3; i++) {
            const month = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + i, 1));

            expectedPartitions.push(getPartitionName(month));
        }

        for (const partition of expectedPartitions) {
            expect(await partitionExists(partition)).toBe(true);
        }
    });

    it("ensureLogsPartitions is safe to run multiple times", async () => {
        await ensureLogsPartitions(testDb);

        const firstResult = await testDb.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM pg_inherits
      WHERE inhparent = 'logs'::regclass
    `);

        await ensureLogsPartitions(testDb);

        const secondResult = await testDb.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM pg_inherits
      WHERE inhparent = 'logs'::regclass
    `);

        expect(secondResult[0]?.count).toBe(firstResult[0]?.count);
    });
});
