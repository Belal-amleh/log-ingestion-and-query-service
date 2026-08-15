import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";

describe("GET /health", () => {
    it("should return 200 when the service is healthy", async () => {
        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
    });
});
