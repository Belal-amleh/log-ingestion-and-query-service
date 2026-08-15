import type { NewLog } from "../db/schema.js";

const validLevels = new Set(["info", "warn", "error", "debug"]);

export function validateLog(value: unknown):
    | { success: true; data: NewLog }
    | {
          success: false;
          error: string;
      } {
    if (typeof value !== "object" || value === null) {
        return {
            success: false,
            error: "Log must be an object"
        };
    }

    const log = value as Record<string, unknown>;

    if (typeof log.timestamp !== "string") {
        return {
            success: false,
            error: "timestamp must be a string"
        };
    }

    const timestamp = new Date(log.timestamp);

    if (Number.isNaN(timestamp.getTime())) {
        return {
            success: false,
            error: "timestamp must be a valid ISO timestamp"
        };
    }

    if (typeof log.level !== "string" || !validLevels.has(log.level)) {
        return {
            success: false,
            error: "level must be info, warn, error, or debug"
        };
    }

    if (typeof log.service !== "string" || log.service.length === 0) {
        return {
            success: false,
            error: "service is required"
        };
    }

    if (typeof log.message !== "string") {
        return {
            success: false,
            error: "message is required"
        };
    }

    if (typeof log.attributes !== "object" || log.attributes === null || Array.isArray(log.attributes)) {
        return {
            success: false,
            error: "attributes must be an object"
        };
    }

    return {
        success: true,
        data: {
            timestamp,
            level: log.level as "info" | "warn" | "error" | "debug",
            service: log.service,
            message: log.message,
            attributes: log.attributes as Record<string, string | number | boolean>
        }
    };
}
