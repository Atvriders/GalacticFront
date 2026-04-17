/**
 * Stub for OpenTelemetry gauge metrics.
 * Replace with real OTEL SDK when instrumentation is wired up.
 */

export interface WorkerMetrics {
  activeGames: number;
  connectedClients: number;
  desyncs: number;
  heapMemory: number;
}

/** Collect current metric snapshot from this worker process. */
export function collectMetrics(activeGames: number, connectedClients: number): WorkerMetrics {
  const mem = process.memoryUsage();
  return {
    activeGames,
    connectedClients,
    desyncs: 0, // TODO: wire up desync counter
    heapMemory: mem.heapUsed,
  };
}

/** Stub: would push metrics to OTEL collector. */
export function reportMetrics(_metrics: WorkerMetrics): void {
  // no-op until OTEL SDK is integrated
}
