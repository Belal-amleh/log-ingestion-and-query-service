import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { testDb, testClient } from "../setup/test-db.js";
import { logs } from "../../src/db/schema.js";

describe("GET /logs/aggregate", () => {
    beforeEach(async () => {
        await testDb.delete(logs);

        await testDb.insert(logs).values([
            // 14:00
            {
                timestamp: new Date("2026-07-20T14:00:00.000Z"),
                level: "info",
                service: "checkout",
                message: "Checkout started",
                attributes: {
                    user_id: "42"
                }
            },

            // 14:01
            {
                timestamp: new Date("2026-07-20T14:01:00.000Z"),
                level: "info",
                service: "checkout",
                message: "Payment processing",
                attributes: {
                    user_id: "42"
                }
            },

            // 14:04
            {
                timestamp: new Date("2026-07-20T14:04:00.000Z"),
                level: "error",
                service: "checkout",
                message: "Payment declined",
                attributes: {
                    user_id: "100"
                }
            },

            // 14:05
            {
                timestamp: new Date("2026-07-20T14:05:00.000Z"),
                level: "error",
                service: "checkout",
                message: "Payment failed",
                attributes: {
                    user_id: "100"
                }
            },

            // 14:07
            {
                timestamp: new Date("2026-07-20T14:07:00.000Z"),
                level: "warn",
                service: "checkout",
                message: "Payment retry",
                attributes: {
                    user_id: "42"
                }
            },

            // 14:10
            {
                timestamp: new Date("2026-07-20T14:10:00.000Z"),
                level: "info",
                service: "auth",
                message: "User authenticated",
                attributes: {
                    user_id: "42"
                }
            },

            // 14:15
            {
                timestamp: new Date("2026-07-20T14:15:00.000Z"),
                level: "error",
                service: "auth",
                message: "Authentication failed",
                attributes: {
                    user_id: "99"
                }
            },

            // 14:30
            {
                timestamp: new Date("2026-07-20T14:30:00.000Z"),
                level: "debug",
                service: "worker",
                message: "Worker started",
                attributes: {
                    worker_id: "7"
                }
            },

            // 15:00
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

    // -----------------------------//
    // Basic aggregation           //
    // ---------------------------//

    it("should return aggregated logs", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1m"
        });

        expect(response.status).toBe(200);

        expect(response.body).toHaveProperty("buckets");
        expect(Array.isArray(response.body.buckets)).toBe(true);

        expect(response.body.buckets.length).toBeGreaterThan(0);
    });

    // -----------------------------//
    // 1 minute bucket             //
    // ---------------------------//

    it("should support 1m buckets", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1m"
        });

        expect(response.status).toBe(200);

        const buckets = response.body.buckets;

        expect(buckets.length).toBeGreaterThan(0);

        for (const bucket of buckets) {
            expect(bucket).toHaveProperty("start");
            expect(bucket).toHaveProperty("group");
            expect(bucket).toHaveProperty("count");

            expect(bucket.group).toBeNull();
            expect(Number(bucket.count)).toBeGreaterThan(0);
        }
    });

    // -----------------------------//
    // 5 minute bucket             //
    // ---------------------------//

    it("should support 5m buckets", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "5m"
        });

        expect(response.status).toBe(200);

        const buckets = response.body.buckets;

        expect(buckets.length).toBeGreaterThan(0);

        for (const bucket of buckets) {
            const minute = new Date(bucket.start).getUTCMinutes();

            expect(minute % 5).toBe(0);
            expect(bucket.group).toBeNull();
            expect(Number(bucket.count)).toBeGreaterThan(0);
        }
    });

    // -----------------------------//
    // 1 hour bucket               //
    // ---------------------------//
    it("should support 1h buckets", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T16:00:00.000Z",
            bucket: "1h"
        });

        expect(response.status).toBe(200);

        const buckets = response.body.buckets;

        expect(buckets.length).toBeGreaterThan(0);

        for (const bucket of buckets) {
            const date = new Date(bucket.start);

            expect(date.getUTCMinutes()).toBe(0);
            expect(date.getUTCSeconds()).toBe(0);
            expect(bucket.group).toBeNull();
        }
    });

    // -----------------------------//
    // 1 day bucket                //
    // ---------------------------//
    it("should support 1d buckets", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T00:00:00.000Z",
            until: "2026-07-21T00:00:00.000Z",
            bucket: "1d"
        });

        expect(response.status).toBe(200);

        const buckets = response.body.buckets;

        expect(buckets.length).toBeGreaterThan(0);

        for (const bucket of buckets) {
            const date = new Date(bucket.start);

            expect(date.getUTCHours()).toBe(0);
            expect(date.getUTCMinutes()).toBe(0);
            expect(date.getUTCSeconds()).toBe(0);
            expect(bucket.group).toBeNull();
        }
    });

    // -----------------------------//
    // No group_by                 //
    // ---------------------------//

    it("should return group as null when group_by is not provided", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1h"
        });

        expect(response.status).toBe(200);

        for (const bucket of response.body.buckets) {
            expect(bucket.group).toBeNull();
        }
    });

    // -----------------------------//
    // group_by=service            //
    // ---------------------------//

    it("should group by service", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1h",
            group_by: "service"
        });

        expect(response.status).toBe(200);

        const buckets = response.body.buckets;

        expect(buckets.length).toBeGreaterThan(0);

        const groups = buckets.map((bucket: { group: string }) => bucket.group);

        expect(groups).toContain("checkout");
        expect(groups).toContain("auth");
        expect(groups).toContain("worker");

        for (const bucket of buckets) {
            expect(typeof bucket.group).toBe("string");
            expect(Number(bucket.count)).toBeGreaterThan(0);
        }
    });

    // -----------------------------//
    // group_by=level              //
    // ---------------------------//

    it("should group by level", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1h",
            group_by: "level"
        });

        expect(response.status).toBe(200);

        const buckets = response.body.buckets;

        expect(buckets.length).toBeGreaterThan(0);

        const groups = buckets.map((bucket: { group: string }) => bucket.group);

        expect(groups).toContain("info");
        expect(groups).toContain("error");
        expect(groups).toContain("warn");
        expect(groups).toContain("debug");

        for (const bucket of buckets) {
            expect(typeof bucket.group).toBe("string");
            expect(Number(bucket.count)).toBeGreaterThan(0);
        }
    });

    // -----------------------------//
    // since inclusive             //
    // ---------------------------//

    it("should treat since as inclusive", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:05:00.000Z",
            until: "2026-07-20T14:06:00.000Z",
            bucket: "1m"
        });

        expect(response.status).toBe(200);

        expect(response.body.buckets.length).toBe(1);
        expect(Number(response.body.buckets[0].count)).toBe(1);
    });

    // -----------------------------//
    // until exclusive             //
    // ---------------------------//

    it("should treat until as exclusive", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:04:00.000Z",
            until: "2026-07-20T14:05:00.000Z",
            bucket: "1m"
        });

        expect(response.status).toBe(200);

        expect(response.body.buckets.length).toBe(1);
        expect(Number(response.body.buckets[0].count)).toBe(1);
    });

    // -----------------------------//
    // service filter              //
    // ---------------------------//

    it("should filter aggregation by service", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1h",
            service: "checkout"
        });

        expect(response.status).toBe(200);

        expect(response.body.buckets.length).toBe(1);

        expect(Number(response.body.buckets[0].count)).toBe(5);
    });

    // -----------------------------//
    // level filter                //
    // ---------------------------//

    it("should filter aggregation by level", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1h",
            level: "error"
        });

        expect(response.status).toBe(200);

        expect(response.body.buckets.length).toBe(1);

        expect(Number(response.body.buckets[0].count)).toBe(3);
    });

    // -----------------------------//
    // attribute filter            //
    // ---------------------------//

    it("should filter aggregation by attribute", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1h",
            "attr.user_id": "42"
        });

        expect(response.status).toBe(200);

        expect(response.body.buckets.length).toBe(1);

        expect(Number(response.body.buckets[0].count)).toBe(4);
    });

    // -----------------------------//
    // q filter                    //
    // ---------------------------//

    it("should filter aggregation using case-insensitive q", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1h",
            q: "PAYMENT"
        });

        expect(response.status).toBe(200);

        expect(response.body.buckets.length).toBe(1);

        expect(Number(response.body.buckets[0].count)).toBe(4);
    });

    // -----------------------------//
    // Combined filters            //
    // ---------------------------//

    it("should support combining multiple filters", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1h",
            service: "checkout",
            level: "error",
            "attr.user_id": "100",
            q: "payment"
        });

        expect(response.status).toBe(200);

        expect(response.body.buckets.length).toBe(1);

        expect(Number(response.body.buckets[0].count)).toBe(2);
    });

    // -----------------------------//
    // Ordering                    //
    // ---------------------------//

    it("should order buckets by start time ascending", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1m"
        });

        expect(response.status).toBe(200);

        const buckets = response.body.buckets;

        for (let i = 1; i < buckets.length; i++) {
            const previous = new Date(buckets[i - 1].start).getTime();

            const current = new Date(buckets[i].start).getTime();

            expect(current).toBeGreaterThanOrEqual(previous);
        }
    });

    // -------------------------------//
    // Invalid parameters            //
    // -----------------------------//

    it("should reject missing since", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1m"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject missing until", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            bucket: "1m"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject missing bucket", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject an invalid bucket", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1h30m"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject the old bucket format", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "hour"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject an invalid group_by", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1h",
            group_by: "message"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject an invalid level", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1h",
            level: "critical"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject an invalid since timestamp", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "not-a-date",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1h"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject an invalid until timestamp", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "not-a-date",
            bucket: "1h"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject until earlier than since", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T15:00:00.000Z",
            until: "2026-07-20T14:00:00.000Z",
            bucket: "1h"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    it("should reject when since equals until", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T14:00:00.000Z",
            bucket: "1h"
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
    });

    // -------------------------//
    // Response shape          //
    // -----------------------//

    it("should return the required response shape", async () => {
        const response = await request(app).get("/logs/aggregate").query({
            since: "2026-07-20T14:00:00.000Z",
            until: "2026-07-20T15:00:00.000Z",
            bucket: "1h"
        });

        expect(response.status).toBe(200);

        expect(response.body).toEqual(
            expect.objectContaining({
                buckets: expect.any(Array)
            })
        );

        for (const bucket of response.body.buckets) {
            expect(bucket).toEqual(
                expect.objectContaining({
                    start: expect.any(String),
                    count: expect.anything()
                })
            );

            expect(bucket).toHaveProperty("group");
        }
    });
});
