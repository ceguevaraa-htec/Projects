const { PrismaClient } = require("@prisma/client");

/**
 * Shared PrismaClient singleton. Import this everywhere instead of
 * instantiating a new PrismaClient, to avoid exhausting SQLite connections.
 */
const prisma = new PrismaClient();

module.exports = prisma;
