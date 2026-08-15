import app from "./app.js";

import { db } from "./db/index.js";
import { ensureLogsPartitions } from "./db/partitions.js";

async function start() {
    try {
        await ensureLogsPartitions(db);
        const PORT = 8080;
        console.log("Log partitions initialized");

        app.listen(PORT, () => {
            console.log("Server running on port 8080");
        });
    } catch (error) {
        console.error("Failed to initialize log partitions:", error);

        process.exit(1);
    }
}

start();
