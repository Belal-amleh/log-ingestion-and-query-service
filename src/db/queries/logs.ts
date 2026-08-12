import {
    and,
    desc,
    eq,
    gte,
    lt,
    or,
    sql,
} from "drizzle-orm";

import { db } from "../index.js";
import { logs, type NewLog } from "../schema.js";

export type InsertLog = {
    timestamp: Date;
    level: string;
    service: string;
    message: string;
    metadata?: unknown;
};

export type QueryLogsOptions = {
    from?: Date;
    to?: Date;
    
    level?: "info" | "warn" | "error" | "debug";
    
    service?: string;
    
    cursorTimestamp?: Date;
    cursorId?: number;
    
    limit: number;
};

export type AggregateOptions = {
  from: Date;
  to: Date;

  bucket:
    | "minute"
    | "hour"
    | "day";
};

export async function insertLogs(
  entries: NewLog[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  await db.insert(logs).values(entries);
}


export async function queryLogs(
  options: QueryLogsOptions,
) {
  const conditions = [];

  if (options.from) {
    conditions.push(
      gte(logs.timestamp, options.from),
    );
  }

  if (options.to) {
    conditions.push(
      lt(logs.timestamp, options.to),
    );
  }

  if (options.level) {
    conditions.push(
      eq(logs.level, options.level),
    );
  }

  if (options.service) {
    conditions.push(
      eq(logs.service, options.service),
    );
  }

  if (
    options.cursorTimestamp &&
    options.cursorId !== undefined
  ) {
    conditions.push(
      or(
        lt(
          logs.timestamp,
          options.cursorTimestamp,
        ),

        and(
          eq(
            logs.timestamp,
            options.cursorTimestamp,
          ),

          lt(
            logs.id,
            options.cursorId,
          ),
        ),
      ),
    );
  }

  return db
    .select()
    .from(logs)
    .where(
      conditions.length > 0
        ? and(...conditions)
        : undefined,
    )
    .orderBy(
      desc(logs.timestamp),
      desc(logs.id),
    )
    .limit(options.limit);
}


function getBucketInterval(
  bucket: AggregateOptions["bucket"],
): string {
  switch (bucket) {
    case "minute":
      return "1 minute";

    case "hour":
      return "1 hour";

    case "day":
      return "1 day";
  }
}

export async function aggregateLogs(
  options: AggregateOptions,
) {
  const interval =
    getBucketInterval(options.bucket);

  const bucketExpression = sql`
    date_bin(
      ${sql.raw(`interval '${interval}'`)},
      ${logs.timestamp},
      timestamptz '1970-01-01'
    )
  `;

  return db
    .select({
      bucket: bucketExpression,

      count: sql<number>`
        count(*)::int
      `,
    })
    .from(logs)
    .where(
      and(
        gte(
          logs.timestamp,
          options.from,
        ),

        lt(
          logs.timestamp,
          options.to,
        ),
      ),
    )
    .groupBy(bucketExpression)
    .orderBy(bucketExpression);
}