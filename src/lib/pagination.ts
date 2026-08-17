export interface Cursor {
    timestamp: Date;
    id: number;
}

export function encodeCursor(cursor: Cursor): string {
    const payload = JSON.stringify({
        timestamp: cursor.timestamp.toISOString(),
        id: cursor.id
    });

    return Buffer.from(payload).toString("base64url");
}

export function decodeCursor(cursor: string): Cursor | null {
    try {
        const decoded = Buffer.from(cursor, "base64url").toString("utf8");

        const parsed: unknown = JSON.parse(decoded);

        if (typeof parsed !== "object" || parsed === null) {
            return null;
        }

        const value = parsed as Record<string, unknown>;

        if (typeof value.timestamp !== "string") {
            return null;
        }

        if (typeof value.id !== "number" || !Number.isInteger(value.id)) {
            return null;
        }

        const timestamp = new Date(value.timestamp);

        if (Number.isNaN(timestamp.getTime())) {
            return null;
        }

        return {
            timestamp,
            id: value.id
        };
    } catch {
        return null;
    }
}
