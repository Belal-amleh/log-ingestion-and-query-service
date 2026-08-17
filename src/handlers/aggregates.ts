import type { Request, Response } from "express";

import { aggregateLogs, type AggregateBucket, type AggregateGroupBy } from "../db/queries/aggregates.js";

const validBuckets = new Set<AggregateBucket>(["1m", "5m", "1h", "1d"]);

const validLevels = new Set(["info", "warn", "error", "debug"]);

const validGroupBy = new Set<AggregateGroupBy>(["service", "level"]);

export async function aggregateLogsHandler(req: Request, res: Response) {
    const sinceValue = typeof req.query.since === "string" ? req.query.since : undefined;

    const untilValue = typeof req.query.until === "string" ? req.query.until : undefined;

    const bucketValue = typeof req.query.bucket === "string" ? req.query.bucket : undefined;

    const groupByValue = typeof req.query.group_by === "string" ? req.query.group_by : undefined;

    const service = typeof req.query.service === "string" ? req.query.service : undefined;

    const level = typeof req.query.level === "string" ? req.query.level : undefined;

    const q = typeof req.query.q === "string" ? req.query.q : undefined;

    //since
    if (sinceValue === undefined) {
        return res.status(400).json({
            error: "since is required"
        });
    }

    const since = new Date(sinceValue);

    if (Number.isNaN(since.getTime())) {
        return res.status(400).json({
            error: "invalid since timestamp"
        });
    }

    //unitl
    if (untilValue === undefined) {
        return res.status(400).json({
            error: "until is required"
        });
    }

    const until = new Date(untilValue);

    if (Number.isNaN(until.getTime())) {
        return res.status(400).json({
            error: "invalid until timestamp"
        });
    }

    //Validate time range.
    if (until <= since) {
        return res.status(400).json({
            error: "until must be after since"
        });
    }

    //bucket
    if (bucketValue === undefined) {
        return res.status(400).json({
            error: "bucket is required"
        });
    }

    if (!validBuckets.has(bucketValue as AggregateBucket)) {
        return res.status(400).json({
            error: "bucket must be 1m, 5m, 1h, or 1d"
        });
    }

    const bucket = bucketValue as AggregateBucket;

    //group_by
    if (groupByValue !== undefined && !validGroupBy.has(groupByValue as AggregateGroupBy)) {
        return res.status(400).json({
            error: "group_by must be service or level"
        });
    }

    const groupBy = groupByValue as AggregateGroupBy | undefined;

    //level
    if (level !== undefined && !validLevels.has(level)) {
        return res.status(400).json({
            error: "invalid level"
        });
    }

    //Attribute filters.
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

        const attributeName = key.slice("attr.".length);

        if (attributeName.length === 0) {
            return res.status(400).json({
                error: "attribute name cannot be empty"
            });
        }

        attributes[attributeName] = value;
    }

    try {
        const result = await aggregateLogs({
            since,
            until,
            bucket,
            groupBy,
            service,
            level: level as "info" | "warn" | "error" | "debug" | undefined,
            attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
            q
        });

        return res.status(200).json({
            buckets: result
        });
    } catch (error) {
        console.error("Failed to aggregate logs:", error);

        return res.status(500).json({
            error: "Failed to aggregate logs"
        });
    }
}
