const path = require("path");

/**
 * Integration/contract tests must never run against the same SQLite file as
 * `npm run dev` (prisma/dev.db) — sharing it causes file-lock contention and
 * state pollution between a running dev server / manual quickstart session
 * and the automated suite. Point these projects at an isolated test
 * database instead; tests/globalSetup.js keeps its schema up to date.
 */
process.env.DATABASE_URL = `file:${path.join(__dirname, "..", "prisma", "test.db")}`;
