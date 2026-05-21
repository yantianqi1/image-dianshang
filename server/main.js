const http = require("node:http");
const { loadConfig } = require("./config");
const { createRouter } = require("./http/router");
const { serveStatic } = require("./http/static");
const { createJobStore } = require("./jobs/store");
const { probeEndpoint, requestOpenAI } = require("./upstream/client");
const { createEndpointMemory } = require("./upstream/memory");
const { createLogger } = require("./upstream/logging");

function main() {
  const config = loadConfig();
  const logger = createLogger();
  const store = createJobStore({ eventSink: (event) => logger.info("job_event", event) });
  const server = http.createServer(createRouter({
    config,
    endpointMemory: createEndpointMemory(),
    logger,
    probeEndpoint,
    requestOpenAI,
    serveStatic,
    store,
  }));

  server.listen(config.port, config.host, () => {
    logger.info("server_started", {
      apiKeyConfigured: Boolean(config.apiKey),
      endpoints: config.endpoints,
      host: config.host,
      port: config.port,
    });
  });

  process.on("SIGTERM", () => shutdown(server, logger));
  process.on("SIGINT", () => shutdown(server, logger));
}

function shutdown(server, logger) {
  logger.info("server_stopping");
  server.close(() => process.exit(0));
}

if (require.main === module) main();

module.exports = { main };
