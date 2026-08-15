import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { testDb, testClient } from "../setup/test-db.js";
import { logs } from "../../src/db/schema.js";

describe("GET /logs/aggregate", () => {
    beforeEach(async () => {
        await testDb.delete(logs);

        await testDb.insert(logs).values([
            {
                timestamp: new Date("2026-08-15T10:05:00.000Z"),
                level: "info",
                service: "api",
                message: "Request received",
                attributes: {}
            },
            {
                timestamp: new Date("2026-08-15T10:15:00.000Z"),
                level: "info",
                service: "api",
                message: "Request completed",
                attributes: {}
            },
            {
                timestamp: new Date("2026-08-15T10:30:00.000Z"),
                level: "error",
                service: "api",
                message: "Request failed",
                attributes: {}
            },
            {
                timestamp: new Date("2026-08-15T11:10:00.000Z"),
                level: "warn",
                service: "worker",
                message: "Worker warning",
                attributes: {}
            }
        ]);
    });

    afterAll(async () => {
        await testClient.end();
    });

    it("should return aggregated logs", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            bucket: "hour"
        });

        expect(response.status).toBe(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
    });

    it("should aggregate logs by time bucket", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            bucket: "hour"
        });

        expect(response.status).toBe(200);

        expect(response.body.length).toBeGreaterThanOrEqual(2);

        for (const bucket of response.body) {
            expect(bucket).toHaveProperty("timestamp");
            expect(bucket).toHaveProperty("count");
        }
    });

    it("should filter aggregation by service", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            bucket: "hour",
            service: "api"
        });

        expect(response.status).toBe(200);

        for (const bucket of response.body) {
            expect(bucket).toHaveProperty("count");
            expect(Number(bucket.count)).toBeGreaterThan(0);
        }
    });

    it("should filter aggregation by level", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            bucket: "hour",
            level: "error"
        });
        console.log("GET /logs/aggregate response:", response.status, response.body);
        expect(response.status).toBe(200);

        expect(response.body.length).toBeGreaterThan(0);

        for (const bucket of response.body) {
            expect(bucket).toHaveProperty("count");
            expect(Number(bucket.count)).toBeGreaterThan(0);
        }
    });
});
