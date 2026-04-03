import { queueDefinitions } from "@obscura/contracts";
import { supportedFingerprintKinds } from "@obscura/media-core";

function bootWorker() {
  const summary = {
    service: "worker",
    queues: queueDefinitions.length,
    fingerprintKinds: supportedFingerprintKinds
  };

  console.log(JSON.stringify(summary, null, 2));
}

bootWorker();

