(async () => {
  localStorage.setItem("if_apikey", "test-key");
  window.__capturedRequests = [];
  window.__jobs = {};
  const imageBytes = Uint8Array.from(
    atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="),
    (char) => char.charCodeAt(0),
  );
  window.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target === "/api/runtime-config") {
      return new Response(JSON.stringify({ apiKeyConfigured: false, endpoints: ["https://good.test/v1"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (target === "/api/render-jobs") {
      const body = JSON.parse(options.body || "{}");
      window.__capturedRequests.push(body.payload);
      window.__jobs.job_1 = {
        id: "job_1",
        traceId: "trace_1",
        status: "completed",
        result: { endpoint: "https://good.test/v1", images: ["https://example.test/fake.png"] },
      };
      return new Response(JSON.stringify({ jobId: "job_1", traceId: "trace_1", status: "queued" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (target === "/api/render-jobs/job_1") {
      return new Response(JSON.stringify(window.__jobs.job_1), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (target === "https://example.test/fake.png") {
      return new Response(imageBytes, { status: 200, headers: { "Content-Type": "image/png" } });
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  window.EventSource = class {
    constructor() {
      this.handlers = {};
      setTimeout(() => {
        this.handlers.job_event?.({ data: JSON.stringify({ type: "completed", jobId: "job_1" }) });
      }, 0);
    }
    addEventListener(type, handler) { this.handlers[type] = handler; }
    close() {}
  };
  await window.ImageForgeApi.loadRuntimeConfig();

  document.querySelector("#gen-prompt").value = "test image";
  document.querySelector("#prompt-count").textContent = "10";
  document.querySelector("#generate-size-grid .size-btn[data-ratio='3:2']").click();
  document.querySelector("#tab-generate .quality-btn[data-quality='medium']").click();
  await window.generateImage();
  return window.__capturedRequests[0];
})();
