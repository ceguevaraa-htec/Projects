/** Jest multi-project config: unit, integration, contract test roots (per plan.md) */
module.exports = {
  // Runs once before any project starts; migrates the isolated integration/
  // contract test database (see tests/setupTestEnv.js) so it never touches
  // prisma/dev.db (the file `npm run dev` uses).
  globalSetup: "<rootDir>/tests/globalSetup.js",
  projects: [
    {
      displayName: "unit",
      testMatch: ["<rootDir>/tests/unit/**/*.test.js"],
      testEnvironment: "node",
    },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/tests/integration/**/*.test.js"],
      testEnvironment: "node",
      setupFiles: ["<rootDir>/tests/setupTestEnv.js"],
    },
    {
      displayName: "contract",
      testMatch: ["<rootDir>/tests/contract/**/*.test.js"],
      testEnvironment: "node",
      setupFiles: ["<rootDir>/tests/setupTestEnv.js"],
    },
  ],
};
