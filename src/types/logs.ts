export type LogSort = "asc" | "desc";

export interface GetLogsParams {
    service?: string;
    level?: "info" | "warn" | "error" | "debug";

    since?: Date;
    until?: Date;

    attributes?: Record<string, string>;

    q?: string;

    cursor?: string;

    limit: number;
}
