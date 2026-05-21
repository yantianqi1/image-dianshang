/* ImageForge same-origin backend client */

(function initImageForgeApi() {
  const LAST_ENDPOINT_KEY = "if_last_backend_endpoint";
  let runtimeConfig = { apiKeyConfigured: false, endpoints: [] };

  async function loadRuntimeConfig() {
    runtimeConfig = await getJson("/api/runtime-config");
    return runtimeConfig;
  }

  function getRuntimeConfig() {
    return { ...runtimeConfig, endpoints: [...(runtimeConfig.endpoints || [])] };
  }

  function hasApiAccess(apiKey) {
    return Boolean(String(apiKey || "").trim() || runtimeConfig.apiKeyConfigured);
  }

  async function resolveApiEndpoint(apiKey) {
    const data = await postJson("/api/connection-test", { apiKey: String(apiKey || "").trim() });
    rememberEndpoint(data.endpoint);
    return { endpoint: data.endpoint, fromCache: false, attempts: [] };
  }

  async function fetchOpenAI(apiKey, path, init) {
    if (path !== "/chat/completions") throw new Error(`Unsupported backend OpenAI path: ${path}`);
    const payload = JSON.parse(init?.body || "{}");
    return fetch("/api/openai/chat-completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: String(apiKey || "").trim(), payload }),
    });
  }

  async function createRenderJob(apiKey, payload, feature) {
    return postJson("/api/render-jobs", {
      apiKey: String(apiKey || "").trim(),
      feature,
      payload,
    });
  }

  async function getRenderJob(jobId) {
    return getJson(`/api/render-jobs/${encodeURIComponent(jobId)}`);
  }

  function connectRenderJobEvents(jobId, onEvent, onError) {
    const source = new EventSource(`/api/render-jobs/${encodeURIComponent(jobId)}/events`);
    source.addEventListener("job_event", (event) => onEvent(JSON.parse(event.data)));
    source.addEventListener("heartbeat", (event) => onEvent({ type: "heartbeat", data: JSON.parse(event.data) }));
    source.onerror = (event) => { if (onError) onError(event); };
    return source;
  }

  function getRememberedEndpoint() {
    return localStorage.getItem(LAST_ENDPOINT_KEY) || "";
  }

  function rememberEndpoint(endpoint) {
    if (endpoint) localStorage.setItem(LAST_ENDPOINT_KEY, endpoint);
  }

  async function getJson(path) {
    const response = await fetch(path, { headers: { "Accept": "application/json" } });
    return parseJsonResponse(response);
  }

  async function postJson(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    return parseJsonResponse(response);
  }

  async function parseJsonResponse(response) {
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (response.ok) return data;
    throw apiError(data, response.status);
  }

  function apiError(data, status) {
    const message = data?.error?.message || `HTTP ${status}`;
    const error = new Error(message);
    error.status = status;
    error.details = data?.error?.details || {};
    return error;
  }

  window.ImageForgeApi = Object.freeze({
    connectRenderJobEvents,
    createRenderJob,
    fetchOpenAI,
    getRememberedEndpoint,
    getRenderJob,
    getRuntimeConfig,
    hasApiAccess,
    loadRuntimeConfig,
    rememberEndpoint,
    resolveApiEndpoint,
  });
})();

