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

    if (params.since !== undefined) {
        conditions.push(gte(logs.timestamp, params.since));
    }

    if (params.until !== undefined) {
        conditions.push(lt(logs.timestamp, params.until));
    }

    if (params.q !== undefined && params.q.length > 0) {
        conditions.push(sql`LOWER(${logs.message}) LIKE LOWER(${"%" + params.q + "%"})`);
    }

    if (params.attributes !== undefined) {
        for (const [key, value] of Object.entries(params.attributes)) {
            conditions.push(sql`${logs.attributes} ->> ${key} = ${value}`);
        }
    }

    if (params.cursor !== undefined) {
        const cursor = decodeCursor(params.cursor);

        if (cursor === null) {
            throw new Error("Invalid cursor");
        }

        conditions.push(
            or(lt(logs.timestamp, cursor.timestamp), and(eq(logs.timestamp, cursor.timestamp), lt(logs.id, cursor.id)))!
        );
    }

    return db
        .select()
        .from(logs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(logs.timestamp), desc(logs.id))
        .limit(params.limit + 1);
}
