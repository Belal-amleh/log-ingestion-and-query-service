import { and, desc, asc, eq, gte, gt, lt, lte, or, sql, type SQL } from "drizzle-orm";

import { db } from "../index.js";
import { logs, type NewLog, type Log } from "../schema.js";
import { decodeCursor } from "../../lib/pagination.js";
import type { GetLogsParams } from "../../types/logs.js";

export async function insertLogs(entries: NewLog[]): Promise<Log[]> {
    if (entries.length === 0) {
        return [];
    }

    return db.insert(logs).values(entries).returning();
}
export async function getLogs(params: GetLogsParams): Promise<Log[]> {
    const conditions: SQL[] = [];

    if (params.service !== undefined) {
        conditions.push(eq(logs.service, params.service));
    }

    if (params.level !== undefined) {
        conditions.push(eq(logs.level, params.level));
    }

    if (params.from !== undefined) {
        conditions.push(gte(logs.timestamp, params.from));
    }

    if (params.to !== undefined) {
        conditions.push(lte(logs.timestamp, params.to));
    }

    if (params.cursor !== undefined) {
        const cursor = decodeCursor(params.cursor);

        if (cursor === null) {
            throw new Error("Invalid cursor");
        }

        if (params.sort === "asc") {
            const cursorCondition = or(
                gt(logs.timestamp, cursor.timestamp),
                and(eq(logs.timestamp, cursor.timestamp), gt(logs.id, cursor.id))
            );

            if (cursorCondition) {
                conditions.push(cursorCondition);
            }
        } else {
            const cursorCondition = or(
                lt(logs.timestamp, cursor.timestamp),
                and(eq(logs.timestamp, cursor.timestamp), lt(logs.id, cursor.id))
            );

            if (cursorCondition) {
                conditions.push(cursorCondition);
            }
        }
    }

    return db
        .select()
        .from(logs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(
            params.sort === "asc" ? asc(logs.timestamp) : desc(logs.timestamp),

            params.sort === "asc" ? asc(logs.id) : desc(logs.id)
        )
        .limit(params.limit + 1);
}
