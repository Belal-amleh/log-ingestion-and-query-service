import { sql } from "drizzle-orm";
import { db } from "../index.js";

export type AggregateBucket = "1m" | "5m" | "1h" | "1d";
export type AggregateGroupBy = "service" | "level";

interface AggregateLogsOptions {
    since: Date;
    until: Date;
    bucket: AggregateBucket;
    groupBy?: AggregateGroupBy;
    service?: string;
    level?: "info" | "warn" | "error" | "debug";
    attributes?: Record<string, string>;
    q?: string;
}

export async function aggregateLogs({
    since,
    until,
    bucket,
    groupBy,
    service,
    level,
    attributes,
    q
}: AggregateLogsOptions) {
    let bucketExpression;

    switch (bucket) {
        case "1m":
            bucketExpression = sql`
                date_trunc('minute', timestamp)
            `;
            break;

        case "5m":
            bucketExpression = sql`
                date_trunc('hour', timestamp)
                + floor(extract(minute from timestamp) / 5)
                * interval '5 minutes'
            `;
            break;

        case "1h":
            bucketExpression = sql`
                date_trunc('hour', timestamp)
            `;
            break;

        case "1d":
            bucketExpression = sql`
                date_trunc('day', timestamp)
            `;
            break;
    }

    let groupExpression;

    if (groupBy === "service") {
        groupExpression = sql`service`;
    } else if (groupBy === "level") {
        groupExpression = sql`level`;
    } else {
        groupExpression = sql`NULL`;
    }

    const conditions = [sql`timestamp >= ${since.toISOString()}`, sql`timestamp < ${until.toISOString()}`];

    if (service !== undefined) {
        conditions.push(sql`service = ${service}`);
    }

    if (level !== undefined) {
        conditions.push(sql`level = ${level}`);
    }

    if (q !== undefined) {
        conditions.push(sql`message ILIKE ${"%" + q + "%"}`);
    }

    if (attributes !== undefined) {
        for (const [key, value] of Object.entries(attributes)) {
            conditions.push(sql`attributes ->> ${key} = ${value}`);
        }
    }

    const whereClause = sql.join(conditions, sql` AND `);

    // Only group by the bucket when group_by is not provided.
    // If group_by is provided, group by both bucket and group.
    const groupByClause = groupBy
        ? sql`
            ${bucketExpression},
            ${groupExpression}
        `
        : sql`
            ${bucketExpression}
        `;

    // Always order by bucket first.
    // Group is only a secondary ordering when grouping is requested.
    const orderByClause = groupBy
        ? sql`
            ${bucketExpression} ASC,
            ${groupExpression} ASC
        `
        : sql`
            ${bucketExpression} ASC
        `;

    const result = await db.execute(sql`
        SELECT
            ${bucketExpression} AS start,
            ${groupExpression} AS group,
            COUNT(*)::int AS count
        FROM logs
        WHERE ${whereClause}
        GROUP BY
            ${groupByClause}
        ORDER BY
            ${orderByClause}
    `);

    return result;
}
