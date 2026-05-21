const { runRenderJob } = require("../render/service");
const { errorFields } = require("../upstream/logging");

function createRouter(deps) {
  return async function route(req, res) {
    try {
      if (req.url.startsWith("/api/")) return handleApi(req, res, deps);
      return deps.serveStatic(req, res, deps.config.staticRoot);
    } catch (error) {
      deps.logger.error("http_unhandled_error", errorFields(error));
      const status = error.status || 500;
      return sendJson(res, status, { error: { message: error.message || String(error) } });
    }
  };
}

async function handleApi(req, res, deps) {
  const url = new URL(req.url, "http://local");
  if (req.method === "GET" && url.pathname === "/api/health") return sendJson(res, 200, { ok: true });
  if (req.method === "GET" && url.pathname === "/api/runtime-config") return runtimeConfig(res, deps);
  if (req.method === "POST" && url.pathname === "/api/connection-test") return connectionTest(req, res, deps);
  if (req.method === "POST" && url.pathname === "/api/openai/chat-completions") return proxyChat(req, res, deps);
  if (req.method === "POST" && url.pathname === "/api/render-jobs") return createRenderJob(req, res, deps);
  const jobMatch = url.pathname.match(/^\/api\/render-jobs\/([^/]+)$/);
  if (req.method === "GET" && jobMatch) return getRenderJob(res, deps, jobMatch[1]);
  const eventMatch = url.pathname.match(/^\/api\/render-jobs\/([^/]+)\/events$/);
  if (req.method === "GET" && eventMatch) return streamRenderJob(req, res, deps, eventMatch[1]);
  return sendJson(res, 404, { error: { message: "Not found" } });
}

function runtimeConfig(res, deps) {
  return sendJson(res, 200, {
    apiKeyConfigured: Boolean(deps.config.apiKey),
    endpoints: deps.config.endpoints,
  });
}

async function connectionTest(req, res, deps) {
  const body = await readJson(req);
  const apiKey = resolveApiKey(body, deps.config);
  const endpoint = await probeFirstWorkingEndpoint(apiKey, deps);
  deps.endpointMemory.remember(apiKey, endpoint);
  return sendJson(res, 200, { endpoint });
}

async function proxyChat(req, res, deps) {
  const body = await readJson(req);
  const apiKey = resolveApiKey(body, deps.config);
  const payload = requireObject(body.payload, "payload");
  const response = await requestViaPool({ apiKey, deps, payload, traceId: body.traceId });
  return sendJson(res, 200, response.data);
}

async function createRenderJob(req, res, deps) {
  const body = await readJson(req);
  const apiKey = resolveApiKey(body, deps.config);
  const payload = requireObject(body.payload, "payload");
  const job = deps.store.createJob({ feature: body.feature || "image", model: payload.model || "" });
  sendJson(res, 202, { jobId: job.id, status: job.status, traceId: job.traceId });
  runRenderJob({
    apiKey,
    jobId: job.id,
    payload,
    requestOpenAI: (request) => requestViaPool({ ...request, deps }),
    store: deps.store,
  });
}

function getRenderJob(res, deps, id) {
  const job = deps.store.getJob(id);
  return job ? sendJson(res, 200, job) : sendJson(res, 404, { error: { message: "Job not found" } });
}

function streamRenderJob(req, res, deps, id) {
  const job = deps.store.getJob(id);
  if (!job) return sendJson(res, 404, { error: { message: "Job not found" } });
  startSse(res);
  const unsubscribe = deps.store.subscribe(id, (event) => writeSse(res, "job_event", event));
  const heartbeat = setInterval(() => writeSse(res, "heartbeat", { jobId: id }), 15000);
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
}

async function requestViaPool(options) {
  const apiKey = options.apiKey;
  const response = await options.deps.requestOpenAI({
    ...options,
    endpoints: options.deps.config.endpoints,
    logger: options.deps.logger,
    preferredEndpoint: options.deps.endpointMemory.get(apiKey),
    timeoutMs: options.deps.config.requestTimeoutMs,
  });
  options.deps.endpointMemory.remember(apiKey, response.endpoint);
  return response;
}

async function probeFirstWorkingEndpoint(apiKey, deps) {
  for (const endpoint of deps.config.endpoints) {
    try {
      return await deps.probeEndpoint({ apiKey, endpoint, timeoutMs: deps.config.probeTimeoutMs });
    } catch (error) {
      deps.logger.warn("endpoint_probe_failed", { endpoint, ...errorFields(error) });
    }
  }
  throw new Error("没有找到匹配当前密钥的 newapi 地址");
}

function resolveApiKey(body, config) {
  const key = String(body.apiKey || config.apiKey || "").trim();
  if (!key) throwHttpError(400, "请先配置 API Key");
  return key;
}

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throwHttpError(400, `Invalid ${name}`);
  return value;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => parseJson(raw, resolve, reject));
    req.on("error", reject);
  });
}

function parseJson(raw, resolve, reject) {
  try {
    resolve(raw ? JSON.parse(raw) : {});
  } catch (error) {
    const invalid = new Error(`Invalid JSON body: ${error.message}`);
    invalid.status = 400;
    reject(invalid);
  }
}

function throwHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Cache-Control": "no-cache",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

function startSse(res) {
  res.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Accel-Buffering": "no",
  });
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

module.exports = { createRouter };
