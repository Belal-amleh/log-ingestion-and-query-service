import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { testDb, testClient } from "../setup/test-db.js";
import { logs } from "../../src/db/schema.js";

describe("POST /logs", () => {
    beforeEach(async () => {
        await testDb.delete(logs);
    });

    afterAll(async () => {
        await testClient.end();
    });

    it("should ingest a batch of logs", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "info",
                        service: "api",
                        message: "User logged in",
                        attributes: {
                            userId: 123,
                            successful: true
                        }
                    },
                    {
                        timestamp: "2026-08-15T12:01:00.000Z",
                        level: "error",
                        service: "database",
                        message: "Database connection failed",
                        attributes: {
                            retry: 3
                        }
                    }
                ]
            });
        console.log("POST /logs response:", response.status, response.body);
        expect(response.status).toBe(201);
    });

    it("should reject an invalid log level", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "INVALID",
                        service: "api",
                        message: "Invalid level",
                        attributes: {}
                    }
                ]
            });

        expect(response.status).toBe(400);
    });

    it("should reject a log with missing required fields", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "info",
                        message: "Missing service",
                        attributes: {}
                    }
                ]
            });

        expect(response.status).toBe(400);
    });

    it("should reject invalid JSON", async () => {
        const response = await request(app).post("/logs").set("Content-Type", "application/json").send('{"logs": [');

        expect(response.status).toBe(400);
    });
});
