import { Router } from "express";
import { healthHandler } from "../handlers/health.js";

const router = Router();

router.get("/health", healthHandler);

export default router;
