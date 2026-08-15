import type { Request, Response } from "express";
import { sql } from "drizzle-orm";

import { db } from "../db/index.js";

export async function healthHandler(_req: Request, res: Response) {
    try {
        await db.execute(sql`SELECT 1`);

        return res.status(200).json({
            status: "ok"
        });
    } catch (error) {
        console.error("Health check failed:", error);

        return res.status(503).json({
            status: "unavailable"
        });
    }
}
