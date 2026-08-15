import { testDb } from "../setup/test-db.js";

import { logs, type NewLog, type Log } from "../../src/db/schema.js";

export async function createTestLog(overrides: Partial<NewLog> = {}): Promise<Log> {
    const log: NewLog = {
        timestamp: new Date(),
        level: "info",
        service: "test-service",
        message: "Test log",
        attributes: {},

        ...overrides
    };

    const [created] = await testDb.insert(logs).values(log).returning();

    if (!created) {
        throw new Error("Failed to create test log");
    }

    return created;
}

export async function createTestLogs(entries: Partial<NewLog>[]): Promise<Log[]> {
    const values: NewLog[] = entries.map((entry) => ({
        timestamp: new Date(),
        level: "info",
        service: "test-service",
        message: "Test log",
        attributes: {},
        ...entry
    }));

    return testDb.insert(logs).values(values).returning();
}
