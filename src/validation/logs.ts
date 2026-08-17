import type { NewLog } from "../db/schema.js";

const validLevels = new Set(["debug", "info", "warn", "error"]);

export function validateLog(value: unknown):
    | { success: true; data: NewLog }
    | {
          success: false;
          error: string;
      } {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {
            success: false,
            error: "log must be an object"
        };
    }

    const log = value as Record<string, unknown>;

    // timestamp
    if (typeof log.timestamp !== "string") {
        return {
            success: false,
            error: "timestamp is required"
        };
    }

    const timestamp = new Date(log.timestamp);

    if (Number.isNaN(timestamp.getTime())) {
        return {
            success: false,
            error: `invalid timestamp: '${log.timestamp}'`
        };
    }

    // Timestamp cannot be more than 5 minutes in the future.
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (timestamp.getTime() > now + fiveMinutes) {
        return {
            success: false,
            error: "timestamp cannot be more than five minutes in the future"
        };
    }

    // level
    if (typeof log.level !== "string") {
        return {
            success: false,
            error: "level is required"
        };
    }

    if (!validLevels.has(log.level)) {
        return {
            success: false,
            error: `invalid level: '${log.level}'`
        };
    }

    // service
    if (typeof log.service !== "string" || log.service.trim().length === 0) {
        return {
            success: false,
            error: "service must be a non-empty string"
        };
    }

    // message
    if (typeof log.message !== "string" || log.message.trim().length === 0) {
        return {
            success: false,
            error: "message must be a non-empty string"
        };
    }

    // attributes are OPTIONAL.
    let attributes: Record<string, string | number | boolean> = {};

    if (log.attributes !== undefined) {
        if (typeof log.attributes !== "object" || log.attributes === null || Array.isArray(log.attributes)) {
            return {
                success: false,
                error: "attributes must be a flat object"
            };
        }

        const inputAttributes = log.attributes as Record<string, unknown>;

        for (const [key, value] of Object.entries(inputAttributes)) {
            const valueType = typeof value;

            if (valueType !== "string" && valueType !== "number" && valueType !== "boolean") {
                return {
                    success: false,
                    error: `attribute '${key}' must be a string, number, or boolean`
                };
            }

            // Reject NaN / Infinity.
            if (valueType === "number" && !Number.isFinite(value)) {
                return {
                    success: false,
                    error: `attribute '${key}' must be a finite number`
                };
            }
        }

        attributes = inputAttributes as Record<string, string | number | boolean>;
    }

    return {
        success: true,
        data: {
            timestamp,
            level: log.level as "debug" | "info" | "warn" | "error",
            service: log.service,
            message: log.message,
            attributes
        }
    };
}
