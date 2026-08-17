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
                timestamp: new Date("2026-07-20T14:00:00.000Z"),
                level: "info",
                service: "checkout",
                message: "Checkout started",
                attributes: {
                    user_id: "42",
                    region: "us"
                }
            },
            {
                timestamp: new Date("2026-07-20T14:05:00.000Z"),
                level: "error",
                service: "checkout",
                message: "Payment declined",
                attributes: {
                    user_id: "42",
                    region: "us"
                }
            },
            {
                timestamp: new Date("2026-07-20T14:10:00.000Z"),
                level: "warn",
                service: "checkout",
                message: "Payment retry",
                attributes: {
                    user_id: "100",
                    region: "eu"
                }
            },
            {
                timestamp: new Date("2026-07-20T14:15:00.000Z"),
                level: "info",
                service: "auth",
                message: "User authenticated",
                attributes: {
                    user_id: "42"
                }
            },
            {
                timestamp: new Date("2026-07-20T14:20:00.000Z"),
                level: "error",
                service: "auth",
                message: "Authentication failed",
                attributes: {
                    user_id: "99"
                }
            },
            {
                timestamp: new Date("2026-07-20T14:25:00.000Z"),
                level: "debug",
                service: "worker",
                message: "Worker started",
                attributes: {
                    worker_id: "7"
                }
            },
            {
                timestamp: new Date("2026-07-20T15:00:00.000Z"),
                level: "info",
                service: "checkout",
                message: "Checkout completed",
                attributes: {
                    user_id: "42"
                }
            }
        ]);
    });

    afterAll(async () => {
        await testClient.end();
    });

    it("should return logs sorted by timestamp descending", async () => {
        const response = await request(app).get("/logs");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("logs");
        expect(response.body).toHaveProperty("next_cursor");

        expect(Array.isArray(response.body.logs)).toBe(true);

        const timestamps = response.body.logs.map((log: { timestamp: string }) => new Date(log.timestamp).getTime());

        for (let i = 1; i < timestamps.length; i++) {
            expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
        }
    });

    it("should return next_cursor as null when there are no more results", async () => {
        const response = await request(app).get("/logs").query({
            limit: 100
        });

        expect(response.status).toBe(200);
        expect(response.body.next_cursor).toBeNull();
    });

    it("should filter by service", async () => {
        const response = await request(app).get("/logs").query({
            service: "checkout"
        });

        expect(response.status).toBe(200);
        expect(response.body.logs.length).toBe(4);

        for (const log of response.body.logs) {
            expect(log.service).toBe("checkout");
        }
    });

    it("should filter by level", async () => {
        const response = await request(app).get("/logs").query({
            level: "error"
        });

        expect(response.status).toBe(200);
        expect(response.body.logs.length).toBe(2);

        for (const log of response.body.logs) {
            expect(log.level).toBe("error");
        }
    });

    it("should filter using since inclusively", async () => {
        const response = await request(app).get("/logs").query({
            since: "2026-07-20T14:10:00.000Z"
        });

        expect(response.status).toBe(200);

        for (const log of response.body.logs) {
            expect(new Date(log.timestamp).getTime()).toBeGreaterThanOrEqual(
                new Date("2026-07-20T14:10:00.000Z").getTime()
            );
        }

        expect(response.body.logs.length).toBe(5);
    });

    it("should filter using until exclusively", async () => {
        const response = await request(app).get("/logs").query({
            until: "2026-07-20T14:20:00.000Z"
        });

        expect(response.status).toBe(200);

        for (const log of response.body.logs) {
            expect(new Date(log.timestamp).getTime()).toBeLessThan(new Date("2026-07-20T14:20:00.000Z").getTime());
        }

        expect(response.body.logs.length).toBe(4);
    });

    it("should combine since and until", async () => {
        const response = await request(app).get("/logs").query({
            since: "2026-07-20T14:05:00.000Z",
            until: "2026-07-20T14:20:00.000Z"
        });

        expect(response.status).toBe(200);
        expect(response.body.logs.length).toBe(3);

        for (const log of response.body.logs) {
            const timestamp = new Date(log.timestamp).getTime();

            expect(timestamp).toBeGreaterThanOrEqual(new Date("2026-07-20T14:05:00.000Z").getTime());

            expect(timestamp).toBeLessThan(new Date("2026-07-20T14:20:00.000Z").getTime());
        }
    });

    it("should filter by attribute", async () => {
        const response = await request(app).get("/logs").query({
            "attr.user_id": "42"
        });

        expect(response.status).toBe(200);
        expect(response.body.logs.length).toBe(4);

        for (const log of response.body.logs) {
            expect(String(log.attributes.user_id)).toBe("42");
        }
    });

    it("should perform a case-insensitive message search", async () => {
        const response = await request(app).get("/logs").query({
            q: "PAYMENT"
        });

        expect(response.status).toBe(200);
        expect(response.body.logs.length).toBe(2);

        for (const log of response.body.logs) {
            expect(log.message.toLowerCase()).toContain("payment");
        }
    });

    it("should combine multiple filters", async () => {
        const response = await request(app).get("/logs").query({
            service: "checkout",
            level: "error",
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            "attr.user_id": "42",
            q: "payment"
        });

        expect(response.status).toBe(200);
        expect(response.body.logs.length).toBe(1);

        const log = response.body.logs[0];

        expect(log.service).toBe("checkout");
        expect(log.level).toBe("error");
        expect(log.attributes.user_id).toBe("42");
        expect(log.message.toLowerCase()).toContain("payment");
    });

    it("should respect the limit parameter", async () => {
        const response = await request(app).get("/logs").query({
            limit: 3
        });

        expect(response.status).toBe(200);
        expect(response.body.logs.length).toBe(3);
    });

    it("should use the default limit of 100", async () => {
        const response = await request(app).get("/logs");

        expect(response.status).toBe(200);
        expect(response.body.logs.length).toBeLessThanOrEqual(100);
    });

    it("should accept the maximum limit of 1000", async () => {
        const response = await request(app).get("/logs").query({
            limit: 1000
        });

        expect(response.status).toBe(200);
        expect(response.body.logs.length).toBeLessThanOrEqual(1000);
    });

    it("should paginate using the cursor", async () => {
        const firstResponse = await request(app).get("/logs").query({
            limit: 3
        });

        expect(firstResponse.status).toBe(200);
        expect(firstResponse.body.logs.length).toBe(3);
        expect(firstResponse.body.next_cursor).not.toBeNull();

        const firstPageIds = firstResponse.body.logs.map((log: { id: string }) => log.id);

        const secondResponse = await request(app).get("/logs").query({
            limit: 3,
            cursor: firstResponse.body.next_cursor
        });

        expect(secondResponse.status).toBe(200);
        expect(secondResponse.body.logs.length).toBeGreaterThan(0);

        const secondPageIds = secondResponse.body.logs.map((log: { id: string }) => log.id);

        for (const id of secondPageIds) {
            expect(firstPageIds).not.toContain(id);
        }
    });

    it("should reject an invalid level", async () => {
        const response = await request(app).get("/logs").query({
            level: "critical"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject an invalid since timestamp", async () => {
        const response = await request(app).get("/logs").query({
            since: "not-a-date"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject an invalid until timestamp", async () => {
        const response = await request(app).get("/logs").query({
            until: "not-a-date"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject until earlier than since", async () => {
        const response = await request(app).get("/logs").query({
            since: "2026-07-20T15:00:00.000Z",
            until: "2026-07-20T14:00:00.000Z"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject a non-numeric limit", async () => {
        const response = await request(app).get("/logs").query({
            limit: "abc"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject limit below 1", async () => {
        const response = await request(app).get("/logs").query({
            limit: 0
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject limit above 1000", async () => {
        const response = await request(app).get("/logs").query({
            limit: 1001
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject a malformed cursor", async () => {
        const response = await request(app).get("/logs").query({
            cursor: "invalid-cursor"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should return the required log fields", async () => {
        const response = await request(app).get("/logs");

        expect(response.status).toBe(200);
        expect(response.body.logs.length).toBeGreaterThan(0);

        const log = response.body.logs[0];

        expect(log).toHaveProperty("id");
        expect(log).toHaveProperty("timestamp");
        expect(log).toHaveProperty("level");
        expect(log).toHaveProperty("service");
        expect(log).toHaveProperty("message");
        expect(log).toHaveProperty("attributes");
    });
});
