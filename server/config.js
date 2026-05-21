const path = require("node:path");
const { parseEndpoints } = require("./upstream/endpoints");

function loadConfig(env = process.env) {
  return {
    apiKey: String(env.IMAGEFORGE_API_KEY || "").trim(),
    endpoints: parseEndpoints(env.IMAGEFORGE_API_ENDPOINTS),
    host: String(env.HOST || "0.0.0.0"),
    port: readInt(env.PORT, 8080),
    probeTimeoutMs: readInt(env.PROBE_TIMEOUT_MS, 10000),
    requestTimeoutMs: readInt(env.REQUEST_TIMEOUT_MS, 300000),
    staticRoot: path.resolve(env.STATIC_ROOT || process.cwd()),
  };
}

function readInt(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer env value: ${value}`);
  }
  return parsed;
}

module.exports = { loadConfig };
