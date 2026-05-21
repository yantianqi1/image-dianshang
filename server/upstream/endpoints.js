const DEFAULT_ENDPOINTS = Object.freeze([
  "https://iai.iisbo.com/v1",
  "https://ai.iisbo.com/v1",
  "https://api2.opcl.cloud/v1",
]);

function parseEndpoints(raw) {
  const values = String(raw || "")
    .split(",")
    .map(normalizeEndpoint)
    .filter(Boolean);
  return values.length ? values : [...DEFAULT_ENDPOINTS];
}

function normalizeEndpoint(endpoint) {
  return String(endpoint || "").trim().replace(/\/+$/, "");
}

function endpointUrl(endpoint, path) {
  return `${normalizeEndpoint(endpoint)}/${String(path || "").replace(/^\/+/, "")}`;
}

function orderEndpoints(endpoints, preferred) {
  const normalized = endpoints.map(normalizeEndpoint).filter(Boolean);
  if (!preferred || !normalized.includes(preferred)) return normalized;
  return [preferred, ...normalized.filter((endpoint) => endpoint !== preferred)];
}

module.exports = {
  DEFAULT_ENDPOINTS,
  endpointUrl,
  normalizeEndpoint,
  orderEndpoints,
  parseEndpoints,
};

