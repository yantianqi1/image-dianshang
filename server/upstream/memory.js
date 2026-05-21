const { createHash } = require("node:crypto");

function createEndpointMemory() {
  const byKey = new Map();

  function get(apiKey) {
    return byKey.get(fingerprint(apiKey)) || "";
  }

  function remember(apiKey, endpoint) {
    byKey.set(fingerprint(apiKey), endpoint);
    return endpoint;
  }

  return { get, remember };
}

function fingerprint(apiKey) {
  return createHash("sha256").update(String(apiKey || "server")).digest("hex").slice(0, 16);
}

module.exports = { createEndpointMemory, fingerprint };

