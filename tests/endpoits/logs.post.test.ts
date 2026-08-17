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

    it("should ingest a batch containing valid logs", async () => {
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
                            user_id: "42",
                            region: "eu-west",
                            retries: 3,
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

        expect(response.status).toBe(200);

        expect(response.body).toEqual({
            accepted: 2,
            rejected: []
        });
    });

    it("should accept a batch containing only one log", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "info",
                        service: "api",
                        message: "Single log"
                    }
                ]
            });

        expect(response.status).toBe(200);

        expect(response.body.accepted).toBe(1);
        expect(response.body.rejected).toEqual([]);
    });

    it("should accept a log without attributes", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "info",
                        service: "api",
                        message: "Log without attributes"
                    }
                ]
            });

        expect(response.status).toBe(200);

        expect(response.body.accepted).toBe(1);
        expect(response.body.rejected).toEqual([]);
    });

    it("should accept all supported log levels", async () => {
        const levels = ["debug", "info", "warn", "error"];

        const response = await request(app)
            .post("/logs")
            .send({
                logs: levels.map((level) => ({
                    timestamp: "2026-08-15T12:00:00.000Z",
                    level,
                    service: "api",
                    message: `Test ${level} log`
                }))
            });

        expect(response.status).toBe(200);

        expect(response.body.accepted).toBe(4);
        expect(response.body.rejected).toEqual([]);
    });

    it("should accept valid logs and reject invalid logs in the same batch", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "info",
                        service: "api",
                        message: "Valid log",
                        attributes: {
                            user_id: "42"
                        }
                    },
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "critical",
                        service: "api",
                        message: "Invalid level",
                        attributes: {}
                    },
                    {
                        timestamp: "2026-08-15T12:01:00.000Z",
                        level: "error",
                        service: "database",
                        message: "Another valid log",
                        attributes: {}
                    }
                ]
            });

        expect(response.status).toBe(200);

        expect(response.body.accepted).toBe(2);

        expect(response.body.rejected).toHaveLength(1);

        expect(response.body.rejected[0]).toEqual({
            index: 1,
            reason: "invalid level: 'critical'"
        });
    });

    it("should reject every invalid entry and return 400 when none are accepted", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "critical",
                        service: "api",
                        message: "Invalid level"
                    },
                    {
                        timestamp: "2026-08-15T12:01:00.000Z",
                        level: "info",
                        service: "",
                        message: "Invalid service"
                    }
                ]
            });

        expect(response.status).toBe(400);

        expect(response.body.accepted).toBe(0);

        expect(response.body.rejected).toHaveLength(2);

        expect(response.body.rejected[0].index).toBe(0);
        expect(response.body.rejected[1].index).toBe(1);
    });

    it("should reject an invalid level", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "critical",
                        service: "api",
                        message: "Invalid level"
                    }
                ]
            });

        expect(response.status).toBe(400);

        expect(response.body.accepted).toBe(0);

        expect(response.body.rejected).toEqual([
            {
                index: 0,
                reason: "invalid level: 'critical'"
            }
        ]);
    });

    it("should reject a missing timestamp", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        level: "info",
                        service: "api",
                        message: "Missing timestamp"
                    }
                ]
            });

        expect(response.status).toBe(400);

        expect(response.body.accepted).toBe(0);
        expect(response.body.rejected[0].index).toBe(0);
    });

    it("should reject an invalid timestamp", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "not-a-timestamp",
                        level: "info",
                        service: "api",
                        message: "Invalid timestamp"
                    }
                ]
            });

        expect(response.status).toBe(400);

        expect(response.body.accepted).toBe(0);

        expect(response.body.rejected[0]).toEqual({
            index: 0,
            reason: "invalid timestamp: 'not-a-timestamp'"
        });
    });

    it("should reject a timestamp more than five minutes in the future", async () => {
        const futureTimestamp = new Date(Date.now() + 6 * 60 * 1000).toISOString();

        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: futureTimestamp,
                        level: "info",
                        service: "api",
                        message: "Future log"
                    }
                ]
            });

        expect(response.status).toBe(400);

        expect(response.body.accepted).toBe(0);

        expect(response.body.rejected[0]).toEqual({
            index: 0,
            reason: "timestamp cannot be more than five minutes in the future"
        });
    });

    it("should accept a timestamp up to five minutes in the future", async () => {
        const futureTimestamp = new Date(Date.now() + 4 * 60 * 1000).toISOString();

        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: futureTimestamp,
                        level: "info",
                        service: "api",
                        message: "Future but allowed log"
                    }
                ]
            });

        expect(response.status).toBe(200);

        expect(response.body.accepted).toBe(1);
        expect(response.body.rejected).toEqual([]);
    });

    it("should reject an empty service", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "info",
                        service: "",
                        message: "Invalid service"
                    }
                ]
            });

        expect(response.status).toBe(400);

        expect(response.body.accepted).toBe(0);
        expect(response.body.rejected[0].index).toBe(0);
    });

    it("should reject a missing service", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "info",
                        message: "Missing service"
                    }
                ]
            });

        expect(response.status).toBe(400);

        expect(response.body.accepted).toBe(0);
        expect(response.body.rejected[0].index).toBe(0);
    });

    it("should reject an empty message", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "info",
                        service: "api",
                        message: ""
                    }
                ]
            });

        expect(response.status).toBe(400);

        expect(response.body.accepted).toBe(0);
        expect(response.body.rejected[0].index).toBe(0);
    });

    it("should reject missing message", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "info",
                        service: "api"
                    }
                ]
            });

        expect(response.status).toBe(400);

        expect(response.body.accepted).toBe(0);
        expect(response.body.rejected[0].index).toBe(0);
    });

    it("should reject nested attributes", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "info",
                        service: "api",
                        message: "Nested attributes",
                        attributes: {
                            user: {
                                id: 42
                            }
                        }
                    }
                ]
            });

        expect(response.status).toBe(400);

        expect(response.body.accepted).toBe(0);
        expect(response.body.rejected[0].index).toBe(0);
    });

    it("should reject array attributes", async () => {
        const response = await request(app)
            .post("/logs")
            .send({
                logs: [
                    {
                        timestamp: "2026-08-15T12:00:00.000Z",
                        level: "info",
                        service: "api",
                        message: "Array attributes",
                        attributes: {
                            tags: ["one", "two"]
                        }
                    }
                ]
            });

        expect(response.status).toBe(400);

        expect(response.body.accepted).toBe(0);
        expect(response.body.rejected[0].index).toBe(0);
    });

    it("should reject invalid top-level body", async () => {
        const response = await request(app).post("/logs").send({
            invalid: "body"
        });

        expect(response.status).toBe(400);

        expect(response.body.error).toBeDefined();
    });

    it("should reject a non-array logs field", async () => {
        const response = await request(app).post("/logs").send({
            logs: "not an array"
        });

        expect(response.status).toBe(400);

        expect(response.body.error).toBeDefined();
    });

    it("should reject an empty logs array", async () => {
        const response = await request(app).post("/logs").send({
            logs: []
        });

        expect(response.status).toBe(400);

        expect(response.body.error).toBeDefined();
    });

    it("should reject malformed JSON", async () => {
        const response = await request(app).post("/logs").set("Content-Type", "application/json").send('{"logs": [');

        expect(response.status).toBe(400);

        expect(response.body.error).toBeDefined();
    });
});
