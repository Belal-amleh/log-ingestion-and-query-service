import express from "express";
import logsRouter from "./routes/logs.js";
import healthRouter from "./routes/health.js";

const app = express();

app.use(express.json());

app.use(logsRouter);
app.use(healthRouter);

export default app;
