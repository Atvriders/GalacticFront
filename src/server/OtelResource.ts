/** OpenTelemetry resource definition for the galacticfront service. */
export const SERVICE_NAME = "galacticfront";

export const otelResource = {
  "service.name": SERVICE_NAME,
  "service.version": process.env.GIT_COMMIT ?? "dev",
};
