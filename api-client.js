/* ImageForge API endpoint pool */

(function initImageForgeApi() {
  const ENDPOINTS = Object.freeze([
    "https://iai.iisbo.com/v1",
    "https://ai.iisbo.com/v1",
    "https://api2.opcl.cloud/v1",
  ]);
  const MEMORY_KEY = "if_endpoint_memory_v1";
  const PROBE_TIMEOUT_MS = 10000;
  const REQUEST_TIMEOUT_MS = 300000;
  const FNV_OFFSET_BASIS = 2166136261;
  const FNV_PRIME = 16777619;

  function normalizeEndpoint(endpoint) {
    return String(endpoint || "").trim().replace(/\/+$/, "");
  }

  function endpointUrl(endpoint, path) {
    return `${normalizeEndpoint(endpoint)}/${String(path || "").replace(/^\/+/, "")}`;
  }

  function keyFingerprint(apiKey) {
    let hash = FNV_OFFSET_BASIS;
    for (const char of String(apiKey || "")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, FNV_PRIME) >>> 0;
    }
    return `fnv1a-${hash.toString(16)}`;
  }

  function readMemory() {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      console.warn("Invalid endpoint memory, ignoring stored value", error);
      return {};
    }
  }

  function writeMemory(memory) {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  }

  function getRememberedEndpoint(apiKey) {
    const endpoint = readMemory()[keyFingerprint(apiKey)];
    return ENDPOINTS.includes(endpoint) ? endpoint : "";
  }

  function rememberEndpoint(apiKey, endpoint) {
    const normalized = normalizeEndpoint(endpoint);
    if (!ENDPOINTS.includes(normalized)) throw new Error(`Unsupported endpoint: ${endpoint}`);
    const memory = readMemory();
    memory[keyFingerprint(apiKey)] = normalized;
    writeMemory(memory);
    return normalized;
  }

  function shuffled(items) {
    const next = items.slice();
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
  }

  function endpointOrder(apiKey, options) {
    const excluded = new Set((options?.exclude || []).map(normalizeEndpoint));
    const remembered = options?.force ? "" : getRememberedEndpoint(apiKey);
    const candidates = ENDPOINTS.filter((endpoint) => !excluded.has(endpoint));
    if (remembered && candidates.includes(remembered)) {
      return [remembered, ...shuffled(candidates.filter((endpoint) => endpoint !== remembered))];
    }
    return shuffled(candidates);
  }

  async function probeEndpoint(apiKey, endpoint) {
    const response = await fetch(endpointUrl(endpoint, "/models"), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (response.ok) return endpoint;
    const text = await response.text();
    throw new Error(`${endpoint} /models HTTP ${response.status}: ${text.slice(0, 240)}`);
  }

  function requireApiKey(apiKey) {
    const key = String(apiKey || "").trim();
    if (!key) throw new Error("请先配置 API Key");
    return key;
  }

  async function resolveApiEndpoint(apiKey, options) {
    const key = requireApiKey(apiKey);
    const remembered = options?.force ? "" : getRememberedEndpoint(key);
    if (remembered) return { endpoint: remembered, fromCache: true, attempts: [] };
    const errors = [];
    for (const endpoint of endpointOrder(key, options)) {
      try {
        const matched = await probeEndpoint(key, endpoint);
        rememberEndpoint(key, matched);
        return { endpoint: matched, fromCache: false, attempts: errors };
      } catch (error) {
        errors.push(error.message || String(error));
      }
    }
    throw new Error(`没有找到匹配当前密钥的 newapi 地址：${errors.join(" | ")}`);
  }

  function requestInit(init, apiKey) {
    const headers = new Headers(init?.headers || {});
    headers.set("Authorization", `Bearer ${apiKey}`);
    return { ...(init || {}), headers, signal: init?.signal || AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
  }

  async function fetchOpenAI(apiKey, path, init, options) {
    const key = requireApiKey(apiKey);
    const errors = [];
    for (const endpoint of endpointOrder(key, options)) {
      try {
        const response = await fetch(endpointUrl(endpoint, path), requestInit(init, key));
        if (response.ok) {
          rememberEndpoint(key, endpoint);
          return response;
        }
        const text = await response.text();
        errors.push(`${endpoint} ${path} HTTP ${response.status}: ${text.slice(0, 240)}`);
      } catch (error) {
        errors.push(`${endpoint} ${path}: ${error.message || String(error)}`);
      }
    }
    throw new Error(`所有 newapi 地址均请求失败：${errors.join(" | ")}`);
  }

  window.ImageForgeApi = Object.freeze({
    ENDPOINTS,
    endpointUrl,
    fetchOpenAI,
    getRememberedEndpoint,
    keyFingerprint,
    rememberEndpoint,
    resolveApiEndpoint,
  });
})();
