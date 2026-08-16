import { sql } from "drizzle-orm";
import { db } from "../index.js";

export type AggregateBucket = "minute" | "hour" | "day";

type AggregateLevel = "info" | "warn" | "error" | "debug";

interface AggregateLogsOptions {
    from: Date;
    to: Date;
    bucket: AggregateBucket;
    service?: string;
    level?: AggregateLevel;
}

export async function aggregateLogs({ from, to, bucket, service, level }: AggregateLogsOptions) {
    const fromISO = from.toISOString();
    const toISO = to.toISOString();

    const bucketSQL =
        bucket === "minute" ? sql.raw("'minute'") : bucket === "hour" ? sql.raw("'hour'") : sql.raw("'day'");

    const result = await db.execute(sql`
    SELECT
      date_trunc(
        ${bucketSQL},
        timestamp
      ) AS timestamp,
      COUNT(*)::int AS count
    FROM logs
    WHERE
      timestamp >= ${fromISO}
      AND timestamp < ${toISO}
      ${service !== undefined ? sql`AND service = ${service}` : sql``}
      ${level !== undefined ? sql`AND level = ${level}` : sql``}
     GROUP BY date_trunc(${bucketSQL}, timestamp)
    ORDER BY timestamp ASC
  `);

    return result;
}
