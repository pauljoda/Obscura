import { startWorker } from "./server.js";

const runtime = await startWorker();

async function shutdown() {
  await runtime.stop();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
