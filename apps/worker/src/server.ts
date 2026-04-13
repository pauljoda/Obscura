import { buildWorkerRuntime, type WorkerTestDeps } from "./runtime.js";

export async function startWorker(deps: WorkerTestDeps = {}) {
  const runtime = buildWorkerRuntime(deps);
  await runtime.start();
  return runtime;
}
