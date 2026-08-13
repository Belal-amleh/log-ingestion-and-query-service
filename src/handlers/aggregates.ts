import type { Request, Response } from "express";
import {
  aggregateLogs,
  type AggregateBucket,
} from "../db/queries/aggregates.js";

const validBuckets = new Set([
  "minute",
  "hour",
  "day",
]);

const validLevels = new Set([
  "info",
  "warn",
  "error",
  "debug",
]);

export async function aggregateLogsHandler(
  req: Request,
  res: Response,
) {
  const fromValue =
    typeof req.query.from === "string"
      ? req.query.from
      : undefined;

  const toValue =
    typeof req.query.to === "string"
      ? req.query.to
      : undefined;

  const bucketValue =
    typeof req.query.bucket === "string"
      ? req.query.bucket
      : undefined;

  const service =
    typeof req.query.service === "string"
      ? req.query.service
      : undefined;

  const level =
    typeof req.query.level === "string"
      ? req.query.level
      : undefined;

  if (fromValue === undefined) {
    return res.status(400).json({
      error: "from is required",
    });
  }

  if (toValue === undefined) {
    return res.status(400).json({
      error: "to is required",
    });
  }

  if (bucketValue === undefined) {
    return res.status(400).json({
      error: "bucket is required",
    });
  }

  if (!validBuckets.has(bucketValue)) {
    return res.status(400).json({
      error: "bucket must be minute, hour, or day",
    });
  }

  const from = new Date(fromValue);
  const to = new Date(toValue);

  if (Number.isNaN(from.getTime())) {
    return res.status(400).json({
      error: "invalid from timestamp",
    });
  }

  if (Number.isNaN(to.getTime())) {
    return res.status(400).json({
      error: "invalid to timestamp",
    });
  }

  if (from >= to) {
    return res.status(400).json({
      error: "from must be before to",
    });
  }

  if (
    level !== undefined &&
    !validLevels.has(level)
  ) {
    return res.status(400).json({
      error: "invalid level",
    });
  }

  try {
    const result = await aggregateLogs({
      from,
      to,
      bucket: bucketValue as AggregateBucket,
      service,
      level: level as
        | "info"
        | "warn"
        | "error"
        | "debug"
        | undefined,
    });

    return res.status(200).json({
      buckets: result,
    });
  } catch (error) {
    console.error(
      "Failed to aggregate logs:",
      error,
    );

    return res.status(500).json({
      error: "Failed to aggregate logs",
    });
  }
}