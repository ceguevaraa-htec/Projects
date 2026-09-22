import { createDb } from "./db/connection.js";
import { migrateToLatest } from "./db/migrate.js";
import { createApp } from "./api/app.js";

const DB_PATH = process.env.DB_PATH ?? "app.db";
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function main(): Promise<void> {
  const db = createDb(DB_PATH);
  await migrateToLatest(db);

  const app = createApp(db);
  app.listen(PORT, () => {
    console.log(JSON.stringify({ event: "server_started", port: PORT, dbPath: DB_PATH }));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
