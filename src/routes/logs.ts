import { Router } from "express";
import { getLogsHandler } from "../handlers/logs.js";
import { ingestLogsHandler } from "../handlers/logs.js";
import { aggregateLogsHandler } from "../handlers/aggregates.js";

const router = Router();
router.post("/logs", ingestLogsHandler);
router.get("/logs", getLogsHandler);
router.get("/logs/aggregate", aggregateLogsHandler);

export default router;
