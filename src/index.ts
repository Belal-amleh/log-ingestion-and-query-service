import express from "express";

import { db } from "./db/index.js";
import { ensureLogsPartitions } from "./db/partitions.js";

import logsRouter from "./routes/logs.js";
import healthRouter from "./routes/health.js";

const app = express();

app.use(express.json());

app.use(healthRouter);
app.use(logsRouter);

async function start() {
  try {
    await ensureLogsPartitions(db);
    
    console.log("Log partitions initialized");

    app.listen(8080, () => {
      console.log("Server running on port 8080");
    });
  } catch (error) {
    console.error(
      "Failed to initialize log partitions:",
      error,
    );

    process.exit(1);
  }
}

start();