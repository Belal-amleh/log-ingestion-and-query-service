import { beforeEach } from "vitest";

import { cleanTestDatabase } from "./cleanup.js";

beforeEach(async () => {
    await cleanTestDatabase();
});
