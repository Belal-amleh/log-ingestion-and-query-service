import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

function getMonthStart(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function getPartitionName(date: Date): string {
    const year = date.getUTCFullYear();

    const month = String(date.getUTCMonth() + 1).padStart(2, "0");

    return `logs_${year}_${month}`;
}

export async function createLogsPartition(db: PostgresJsDatabase, date: Date): Promise<void> {
    const start = getMonthStart(date);

    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

    const partitionName = getPartitionName(start);

    const startISO = start.toISOString();
    const endISO = end.toISOString();

    await db.execute(
        sql.raw(`
    CREATE TABLE IF NOT EXISTS "${partitionName}"
    PARTITION OF "logs"
    FOR VALUES FROM ('${startISO}')
    TO ('${endISO}')
  `)
    );
}
export async function ensureLogsPartitions(db: PostgresJsDatabase): Promise<void> {
    const now = new Date();

    const currentMonth = getMonthStart(now);

    for (let i = 0; i < 3; i++) {
        const month = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + i, 1));

        await createLogsPartition(db, month);
    }
}
