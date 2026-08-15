export type LogSort = "asc" | "desc";

export type GetLogsParams = {
    service?: string;
    level?: "info" | "warn" | "error" | "debug";
    from?: Date;
    to?: Date;
    limit: number;
    cursor?: string;
    sort: LogSort;
};
