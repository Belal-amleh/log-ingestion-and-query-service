import type { Request, Response } from "express";
import { validateLog } from "../validation/logs.js";
import { insertLogs, getLogs } from "../db/queries/logs.js";
import { decodeCursor, encodeCursor } from "../lib/pagination.js";
import { LogSort } from "../types/logs.js";

export async function ingestLogsHandler(req: Request, res: Response) {
    if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
        return res.status(400).json({
            error: "request body must be an object"
        });
    }

    const entries = req.body.logs;

    if (!Array.isArray(entries)) {
        return res.status(400).json({
            error: "logs must be an array"
        });
    }

    if (entries.length === 0) {
        return res.status(400).json({
            error: "logs must contain at least one entry"
        });
    }

    const validLogs = [];

    const rejected: {
        index: number;
        reason: string;
    }[] = [];

    for (let i = 0; i < entries.length; i++) {
        const result = validateLog(entries[i]);

        if (!result.success) {
            rejected.push({
                index: i,
                reason: result.error
            });

            continue;
        }

        validLogs.push(result.data);
    }

    // Everything was rejected.
    if (validLogs.length === 0) {
        return res.status(400).json({
            accepted: 0,
            rejected
        });
    }

    try {
        const inserted = await insertLogs(validLogs);

        return res.status(200).json({
            accepted: inserted.length,
            rejected
        });
    } catch (error) {
        console.error("Failed to ingest logs:", error);

        return res.status(500).json({
            error: "Failed to ingest logs"
        });
    }
}

export async function getLogsHandler(req: Request, res: Response) {
    const service = typeof req.query.service === "string" ? req.query.service : undefined;

    const level = typeof req.query.level === "string" ? req.query.level : undefined;

    const sinceValue = typeof req.query.since === "string" ? req.query.since : undefined;

    const untilValue = typeof req.query.until === "string" ? req.query.until : undefined;

    const q = typeof req.query.q === "string" ? req.query.q : undefined;

    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const limitValue = typeof req.query.limit === "string" ? Number(req.query.limit) : 100;

    if (level !== undefined && level !== "info" && level !== "warn" && level !== "error" && level !== "debug") {
        return res.status(400).json({
            error: "invalid level"
        });
    }

    if (!Number.isInteger(limitValue) || limitValue <= 0 || limitValue > 1000) {
        return res.status(400).json({
            error: "limit must be between 1 and 1000"
        });
    }

    let since: Date | undefined;

    if (sinceValue !== undefined) {
        since = new Date(sinceValue);

        if (Number.isNaN(since.getTime())) {
            return res.status(400).json({
                error: "invalid since timestamp"
            });
        }
    }

    let until: Date | undefined;

    if (untilValue !== undefined) {
        until = new Date(untilValue);

        if (Number.isNaN(until.getTime())) {
            return res.status(400).json({
                error: "invalid until timestamp"
            });
        }
    }

    if (since !== undefined && until !== undefined && until <= since) {
        return res.status(400).json({
            error: "until must be later than since"
        });
    }

    if (cursor !== undefined) {
        if (decodeCursor(cursor) === null) {
            return res.status(400).json({
                error: "invalid cursor"
            });
        }
    }

    const attributes: Record<string, string> = {};

    for (const [key, value] of Object.entries(req.query)) {
        if (!key.startsWith("attr.")) {
            continue;
        }

        if (typeof value !== "string") {
            return res.status(400).json({
                error: `invalid attribute parameter: ${key}`
            });
        }

        const attributeName = key.substring("attr.".length);

        if (attributeName.length === 0) {
            return res.status(400).json({
                error: "attribute name cannot be empty"
            });
        }

        attributes[attributeName] = value;
    }

    try {
        const rows = await getLogs({
            service,
            level: level as "info" | "warn" | "error" | "debug" | undefined,

            since,
            until,

            attributes: Object.keys(attributes).length > 0 ? attributes : undefined,

            q,

            cursor,

            limit: limitValue
        });

        const hasMore = rows.length > limitValue;

        const resultLogs = hasMore ? rows.slice(0, limitValue) : rows;

        let nextCursor: string | null = null;

        if (hasMore) {
            const last = resultLogs[resultLogs.length - 1];

            if (!last) {
                return res.status(500).json({
                    error: "Failed to create pagination cursor"
                });
            }

            nextCursor = encodeCursor({
                timestamp: last.timestamp,
                id: last.id
            });
        }

        return res.status(200).json({
            logs: resultLogs,
            next_cursor: nextCursor
        });
    } catch (error) {
        console.error("Failed to get logs:", error);

        return res.status(500).json({
            error: "Failed to get logs"
        });
    }
}
