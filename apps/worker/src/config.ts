export interface WorkerConfiguration {
  batchSize: number;
  confirmationDepth: number;
  pollIntervalMs: number;
}

function boundedInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = environment[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

export function parseWorkerConfiguration(environment: NodeJS.ProcessEnv): WorkerConfiguration {
  return {
    batchSize: boundedInteger(environment, "WORKER_BATCH_SIZE", 25, 1, 1_000),
    confirmationDepth: boundedInteger(environment, "WORKER_CONFIRMATION_DEPTH", 4, 0, 1_024),
    pollIntervalMs: boundedInteger(environment, "WORKER_POLL_INTERVAL_MS", 15_000, 100, 3_600_000),
  };
}
