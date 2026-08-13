import { sql } from "drizzle-orm";
import { db } from "../index.js";

export type AggregateBucket =
  | "minute"
  | "hour"
  | "day";

type AggregateParams = {
  from: Date;
  to: Date;
  bucket: AggregateBucket;
  service?: string;
  level?: "info" | "warn" | "error" | "debug";
};

const bucketSql = {
  minute: sql`'minute'`,
  hour: sql`'hour'`,
  day: sql`'day'`,
};

export async function aggregateLogs(
  params: AggregateParams,
) {
  const result = await db.execute(sql`
    SELECT
      date_trunc(
        ${bucketSql[params.bucket]},
        timestamp
      ) AS bucket,
      COUNT(*)::int AS count
    FROM logs
    WHERE
      timestamp >= ${params.from}
      AND timestamp < ${params.to}
      ${
        params.service !== undefined
          ? sql`AND service = ${params.service}`
          : sql``
      }
      ${
        params.level !== undefined
          ? sql`AND level = ${params.level}`
          : sql``
      }
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  return result;
}