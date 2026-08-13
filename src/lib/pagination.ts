export type LogCursor = {
  timestamp: Date;
  id: number;
};

export function encodeCursor(
  cursor: LogCursor,
): string {
  return Buffer.from(
    JSON.stringify({
      timestamp: cursor.timestamp.toISOString(),
      id: cursor.id,
    }),
  ).toString("base64url");
}

export function decodeCursor(
  value: string,
): LogCursor | null {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );

    if (
      typeof decoded !== "object" ||
      decoded === null
    ) {
      return null;
    }

    const data = decoded as {
      timestamp?: unknown;
      id?: unknown;
    };

    if (
      typeof data.timestamp !== "string" ||
      typeof data.id !== "number"
    ) {
      return null;
    }

    const timestamp = new Date(data.timestamp);

    if (Number.isNaN(timestamp.getTime())) {
      return null;
    }

    return {
      timestamp,
      id: data.id,
    };
  } catch {
    return null;
  }
}