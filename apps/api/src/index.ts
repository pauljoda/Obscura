import { startApiServer } from "./server";

const runtime = await startApiServer();

async function shutdown() {
  await runtime.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
