const { endpointUrl, orderEndpoints } = require("./endpoints");
const { createLogger } = require("./logging");

const DEFAULT_TIMEOUT_MS = 300000;

async function requestOpenAI(options) {
  const endpoints = orderEndpoints(options.endpoints || [], options.preferredEndpoint);
  const errors = [];
  const logger = options.logger || createLogger();

  for (const endpoint of endpoints) {
    try {
      const response = await postJson({ ...options, endpoint });
      if (response.ok) return parseSuccessResponse(response, endpoint, logger, options.traceId);
      const message = await responseError(response, endpoint, options.path);
      logger.warn("upstream_http_failed", { endpoint, message, traceId: options.traceId });
      errors.push(message);
    } catch (error) {
      logger.warn("upstream_request_error", { endpoint, message: error.message || String(error), traceId: options.traceId });
      errors.push(`${endpoint} ${options.path}: ${error.message || String(error)}`);
    }
  }

  const error = new Error(`所有 newapi 地址均请求失败：${errors.join(" | ")}`);
  error.code = "UPSTREAM_REQUEST_FAILED";
  error.details = { attempts: errors };
  throw error;
}

async function postJson(options) {
  const fetchImpl = options.fetchImpl || fetch;
  return fetchImpl(endpointUrl(options.endpoint, options.path), {
    body: JSON.stringify(options.payload || {}),
    headers: requestHeaders(options.apiKey),
    method: "POST",
    signal: timeoutSignal(options.timeoutMs),
  });
}

function requestHeaders(apiKey) {
  const headers = { "Accept": "application/json", "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function timeoutSignal(timeoutMs) {
  const ms = Number(timeoutMs || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(ms) && ms > 0 ? AbortSignal.timeout(ms) : undefined;
}

async function parseSuccessResponse(response, endpoint, logger, traceId) {
  const data = await response.json();
  logger.info("upstream_http_ok", { endpoint, status: response.status, traceId });
  return { data, endpoint, status: response.status };
}

async function responseError(response, endpoint, path) {
  const text = await response.text();
  return `${endpoint} ${path} HTTP ${response.status}: ${text.slice(0, 500)}`;
}

async function probeEndpoint(options) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(endpointUrl(options.endpoint, "/models"), {
    headers: requestHeaders(options.apiKey),
    method: "GET",
    signal: timeoutSignal(options.timeoutMs || 10000),
  });
  if (response.ok) return options.endpoint;
  throw new Error(await responseError(response, options.endpoint, "/models"));
}

module.exports = { requestOpenAI, probeEndpoint };
