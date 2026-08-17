import express from "express";
import logsRouter from "./routes/logs.js";
import healthRouter from "./routes/health.js";

const app = express();

app.use(express.json());

app.use(logsRouter);
app.use(healthRouter);

// JSON parsing errors
app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof SyntaxError) {
        return res.status(400).json({
            error: "malformed JSON"
        });
    }

    next(error);
});

export default app;
