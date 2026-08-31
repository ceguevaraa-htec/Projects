const path = require("path");
const { execSync } = require("child_process");

/**
 * Applies migrations to the isolated integration/contract test database
 * (tests/setupTestEnv.js points DATABASE_URL at it) before any test file
 * runs, so the schema is current without touching prisma/dev.db.
 */
module.exports = async function globalSetup() {
  const dbPath = path.join(__dirname, "..", "prisma", "test.db");
  execSync("npx prisma migrate deploy", {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: "inherit",
  });
};
