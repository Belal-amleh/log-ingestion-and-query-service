import type { Request, Response } from "express";
import { aggregateLogs, type AggregateBucket } from "../db/queries/aggregates.js";

const validBuckets = new Set<AggregateBucket>(["minute", "hour", "day"]);

const validLevels = new Set(["info", "warn", "error", "debug"]);

export async function aggregateLogsHandler(req: Request, res: Response) {
    /*
     * from and to are optional.
     *
     * If they are not provided:
     *   from = start of the current UTC day
     *   to   = current time
     */
    const now = new Date();

    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const fromValue = typeof req.query.from === "string" ? req.query.from : undefined;

    const toValue = typeof req.query.to === "string" ? req.query.to : undefined;

    const bucketValue = typeof req.query.bucket === "string" ? req.query.bucket : undefined;

    const service = typeof req.query.service === "string" ? req.query.service : undefined;

    const level = typeof req.query.level === "string" ? req.query.level : undefined;
    //bucket
    if (bucketValue === undefined) {
        return res.status(400).json({
            error: "bucket is required"
        });
    }

    if (!validBuckets.has(bucketValue as AggregateBucket)) {
        return res.status(400).json({
            error: "bucket must be minute, hour, or day"
        });
    }

    const bucket = bucketValue as AggregateBucket;

    // from
    let from: Date;

    if (fromValue === undefined) {
        from = defaultFrom;
    } else {
        from = new Date(fromValue);

        if (Number.isNaN(from.getTime())) {
            return res.status(400).json({
                error: "invalid from timestamp"
            });
        }
    }

    // to
    let to: Date;

    if (toValue === undefined) {
        to = now;
    } else {
        to = new Date(toValue);

        if (Number.isNaN(to.getTime())) {
            return res.status(400).json({
                error: "invalid to timestamp"
            });
        }
    }

    // validate date range
    if (from >= to) {
        return res.status(400).json({
            error: "from must be before to"
        });
    }

    // level
    if (level !== undefined && !validLevels.has(level)) {
        return res.status(400).json({
            error: "invalid level"
        });
    }

    // database query
    try {
        const result = await aggregateLogs({
            from,
            to,
            bucket,
            service,
            level: level as "info" | "warn" | "error" | "debug" | undefined
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error("Failed to aggregate logs:", error);

        return res.status(500).json({
            error: "Failed to aggregate logs"
        });
    }
}
