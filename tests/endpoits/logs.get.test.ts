import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { testDb, testClient } from "../setup/test-db.js";
import { logs } from "../../src/db/schema.js";

describe("GET /logs", () => {
    beforeEach(async () => {
        await testDb.delete(logs);

        await testDb.insert(logs).values([
            {
                timestamp: new Date("2026-08-15T10:00:00.000Z"),
                level: "info",
                service: "api",
                message: "API started",
                attributes: {}
            },
            {
                timestamp: new Date("2026-08-15T11:00:00.000Z"),
                level: "error",
                service: "api",
                message: "API error",
                attributes: {
                    code: 500
                }
            },
            {
                timestamp: new Date("2026-08-15T12:00:00.000Z"),
                level: "warn",
                service: "worker",
                message: "Worker warning",
                attributes: {}
            },
            {
                timestamp: new Date("2026-08-15T13:00:00.000Z"),
                level: "debug",
                service: "worker",
                message: "Worker debug",
                attributes: {}
            }
        ]);
    });

    afterAll(async () => {
        await testClient.end();
    });

    it("should return logs", async () => {
        const response = await request(app).get("/logs");

        expect(response.status).toBe(200);

        expect(response.body).toHaveProperty("logs");
        expect(Array.isArray(response.body.logs)).toBe(true);
        expect(response.body.logs.length).toBeGreaterThan(0);
    });

    it("should filter logs by level", async () => {
        const response = await request(app).get("/logs").query({
            level: "error"
        });

        expect(response.status).toBe(200);

        expect(response.body.logs).toHaveLength(1);
        expect(response.body.logs[0].level).toBe("error");
    });

    it("should filter logs by service", async () => {
        const response = await request(app).get("/logs").query({
            service: "worker"
        });

        expect(response.status).toBe(200);

        expect(response.body.logs).toHaveLength(2);

        for (const log of response.body.logs) {
            expect(log.service).toBe("worker");
        }
    });

    it("should combine filters", async () => {
        const response = await request(app).get("/logs").query({
            level: "error",
            service: "api"
        });

        expect(response.status).toBe(200);

        expect(response.body.logs).toHaveLength(1);
        expect(response.body.logs[0].level).toBe("error");
        expect(response.body.logs[0].service).toBe("api");
    });

    it("should return logs within a time range", async () => {
        const response = await request(app).get("/logs").query({
            from: "2026-08-15T10:30:00.000Z",
            to: "2026-08-15T12:30:00.000Z"
        });

        expect(response.status).toBe(200);

        expect(response.body.logs).toHaveLength(2);

        for (const log of response.body.logs) {
            const timestamp = new Date(log.timestamp).getTime();

            expect(timestamp).toBeGreaterThanOrEqual(new Date("2026-08-15T10:30:00.000Z").getTime());

            expect(timestamp).toBeLessThanOrEqual(new Date("2026-08-15T12:30:00.000Z").getTime());
        }
    });

    it("should support limit", async () => {
        const response = await request(app).get("/logs").query({
            limit: 2
        });

        expect(response.status).toBe(200);
        expect(response.body.logs).toHaveLength(2);
    });

    it("should support cursor pagination", async () => {
        const firstResponse = await request(app).get("/logs").query({
            limit: 2
        });

        expect(firstResponse.status).toBe(200);
        expect(firstResponse.body.logs).toHaveLength(2);

        expect(firstResponse.body).toHaveProperty("nextCursor");

        const cursor = firstResponse.body.nextCursor;

        expect(cursor).toBeTruthy();

        const secondResponse = await request(app).get("/logs").query({
            limit: 2,
            cursor
        });

        expect(secondResponse.status).toBe(200);
        expect(secondResponse.body.logs).toHaveLength(2);

        const firstPageIds = firstResponse.body.logs.map((log: { id: number }) => log.id);

        const secondPageIds = secondResponse.body.logs.map((log: { id: number }) => log.id);

        for (const id of secondPageIds) {
            expect(firstPageIds).not.toContain(id);
        }
    });
});
