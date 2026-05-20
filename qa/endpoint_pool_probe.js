(async () => {
  const goodEndpoint = "https://ai.iisbo.com/v1";
  const calls = [];
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  const imageBytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0));

  localStorage.clear();
  window.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ url: target, body: options.body ? JSON.parse(options.body) : null });
    if (target.endsWith("/models")) {
      const ok = target.startsWith(goodEndpoint);
      return new Response(JSON.stringify(ok ? { data: [{ id: "gpt-image-2" }] } : { error: { message: "bad key" } }), {
        status: ok ? 200 : 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (target.endsWith("/chat/completions") && target.startsWith(goodEndpoint)) {
      return new Response(JSON.stringify({
        choices: [{ message: { content: "![image_1](https://example.test/fake.png)" } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (target === "https://example.test/fake.png") {
      return new Response(imageBytes, { status: 200, headers: { "Content-Type": "image/png" } });
    }
    return new Response(JSON.stringify({ error: { message: "wrong endpoint" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  };

  openSettings();
  document.querySelector("#setting-apikey").value = "pool-key";
  await saveSettings();

  const modelCalls = calls.filter((call) => call.url.endsWith("/models"));
  if (!modelCalls.some((call) => call.url.startsWith(goodEndpoint))) {
    throw new Error(`good endpoint was not probed: ${modelCalls.map((call) => call.url).join(", ")}`);
  }

  calls.length = 0;
  switchTab("generate");
  document.querySelector("#gen-prompt").value = "pool test";
  document.querySelector("#prompt-count").textContent = "9";
  await generateImage();

  const chatCalls = calls.filter((call) => call.url.endsWith("/chat/completions"));
  if (chatCalls.length !== 1 || !chatCalls[0].url.startsWith(goodEndpoint)) {
    throw new Error(`generation did not use remembered endpoint: ${chatCalls.map((call) => call.url).join(", ")}`);
  }
  if (calls.some((call) => call.url.endsWith("/models"))) {
    throw new Error("cached endpoint should not re-probe models on generation");
  }

  window.ImageForgeApi.rememberEndpoint("pool-key", "https://iai.iisbo.com/v1");
  calls.length = 0;
  await generateImage();

  const failoverChatCalls = calls.filter((call) => call.url.endsWith("/chat/completions"));
  if (!failoverChatCalls.some((call) => call.url.startsWith(goodEndpoint))) {
    throw new Error(`failover did not reach good endpoint: ${failoverChatCalls.map((call) => call.url).join(", ")}`);
  }
  if (window.ImageForgeApi.getRememberedEndpoint("pool-key") !== goodEndpoint) {
    throw new Error("successful failover endpoint was not persisted");
  }
  if (localStorage.getItem("if_endpoint_memory_v1").includes("pool-key")) {
    throw new Error("endpoint memory must not store raw api key");
  }

  return { modelCalls, chatCalls, failoverChatCalls, stored: localStorage.getItem("if_endpoint_memory_v1") };
})();
