import type { Request, Response } from "express";

import { insertLogs, queryLogs } from "../db/queries/logs.js";

const VALID_LEVELS = [
  "info",
  "warn",
  "error",
  "debug",
] as const;

type LogLevel =
  (typeof VALID_LEVELS)[number];

function isLogLevel(
  value: unknown,
): value is LogLevel {
  return (
    typeof value === "string" &&
    VALID_LEVELS.includes(
      value as LogLevel,
    )
  );
}
export async function postLogs(
  req: Request,
  res: Response,
) {
  const body = req.body;

  if (
    !body ||
    !Array.isArray(body.logs)
  ) {
    return res.status(400).json({
      error: "logs must be an array",
    });
  }

  if (body.logs.length === 0) {
    return res.status(400).json({
      error: "logs cannot be empty",
    });
  }

  const entries = [];

  for (const entry of body.logs) {
    if (!entry || typeof entry !== "object") {
      return res.status(400).json({
        error: "Invalid log entry",
      });
    }

    if (
      typeof entry.timestamp !== "string" ||
      !isLogLevel(entry.level) ||
      typeof entry.service !== "string" ||
      typeof entry.message !== "string"
    ) {
      return res.status(400).json({
        error: "Invalid log entry",
      });
    }

    const timestamp =
      new Date(entry.timestamp);

    if (
      Number.isNaN(timestamp.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid timestamp",
      });
    }

    entries.push({
      timestamp,

      level: entry.level,

      service: entry.service,

      message: entry.message,

      attributes:
        entry.attributes ?? {},
    });
  }

  try {
    await insertLogs(entries);

    return res.status(201).json({
      inserted: entries.length,
    });
  } catch (error) {
    console.error(
      "Failed to insert logs:",
      error,
    );

    return res.status(500).json({
      error: "Failed to insert logs",
    });
  }
}
export async function getLogs(
  req: Request,
  res: Response,
) {
  try {
    const from = parseDate(
      req.query.from,
    );

    const to = parseDate(
      req.query.to,
    );

    const level =
      parseLevel(req.query.level);

    const service =
      parseService(req.query.service);

    const limit =
      parseLimit(req.query.limit);

    const cursor =
      parseCursor(req.query.cursor);

    const result =
      await queryLogs({
        from,
        to,
        level,
        service,

        cursorTimestamp:
          cursor?.timestamp,

        cursorId:
          cursor?.id,

        limit,
      });

    const nextCursor =
      result.length === limit
        ? createCursor(
            result[result.length - 1].timestamp,
            result[result.length - 1].id,
          )
        : null;

    return res.status(200).json({
      logs: result,
      nextCursor,
    });
  } catch (error) {
    return res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Invalid request",
    });
  }
}