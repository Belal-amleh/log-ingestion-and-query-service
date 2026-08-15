import type { Request, Response } from "express";
import { validateLog } from "../validation/logs.js";
import { insertLogs, getLogs } from "../db/queries/logs.js";
import { decodeCursor, encodeCursor } from "../lib/pagination.js";
import { LogSort } from "../types/logs.js";

export async function ingestLogsHandler(req: Request, res: Response) {
    /*
     * Expected request body:
     *
     * {
     *   logs: [
     *     {
     *       timestamp: "...",
     *       level: "info",
     *       service: "api",
     *       message: "...",
     *       attributes: {}
     *     }
     *   ]
     * }
     */

    if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
        return res.status(400).json({
            error: "Request body must be an object"
        });
    }

    const entries = req.body.logs;

    if (!Array.isArray(entries)) {
        return res.status(400).json({
            error: "logs must be an array"
        });
    }

    const validatedLogs = [];

    for (let i = 0; i < entries.length; i++) {
        const result = validateLog(entries[i]);

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                index: i
            });
        }

        validatedLogs.push(result.data);
    }

    try {
        const inserted = await insertLogs(validatedLogs);

        return res.status(201).json({
            count: inserted.length
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

    const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;

    const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;

    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const sortValue = typeof req.query.sort === "string" ? req.query.sort : "desc";

    if (sortValue !== "asc" && sortValue !== "desc") {
        return res.status(400).json({
            error: "sort must be asc or desc"
        });
    }

    const sort: LogSort = sortValue;

    if (level !== undefined) {
        if (level !== "info" && level !== "warn" && level !== "error" && level !== "debug") {
            return res.status(400).json({
                error: "invalid level"
            });
        }
    }

    if (from !== undefined && Number.isNaN(from.getTime())) {
        return res.status(400).json({
            error: "invalid from timestamp"
        });
    }

    if (to !== undefined && Number.isNaN(to.getTime())) {
        return res.status(400).json({
            error: "invalid to timestamp"
        });
    }

    if (cursor !== undefined && decodeCursor(cursor) === null) {
        return res.status(400).json({
            error: "invalid cursor"
        });
    }

    const limitValue = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;

    if (!Number.isInteger(limitValue) || limitValue <= 0 || limitValue > 100) {
        return res.status(400).json({
            error: "limit must be between 1 and 100"
        });
    }

    try {
        const rows = await getLogs({
            service,
            level: level as "info" | "warn" | "error" | "debug" | undefined,
            from,
            to,
            cursor,
            sort,
            limit: limitValue
        });

        const hasMore = rows.length > limitValue;

        const resultLogs = hasMore ? rows.slice(0, limitValue) : rows;

        let nextCursor: string | null = null;

        if (hasMore) {
            const last = resultLogs[resultLogs.length - 1];

            if (!last || last.id === undefined) {
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
            nextCursor
        });
    } catch (error) {
        console.error("Failed to get logs:", error);

        return res.status(500).json({
            error: "Failed to get logs"
        });
    }
}
