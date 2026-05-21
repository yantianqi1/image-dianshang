(async () => {
  const results = [];
  const requests = [];
  const jobs = {};
  let imageId = 0;
  let jobId = 0;
  const pngBytes = Uint8Array.from(
    atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="),
    (char) => char.charCodeAt(0),
  );

  const ok = (name, details = {}) => results.push({ name, ok: true, details });
  const bad = (name, error, details = {}) => results.push({ name, ok: false, error: String(error?.message || error), details });
  const byId = (id) => document.getElementById(id);
  const sampleFile = () => new File([pngBytes], "sample.png", { type: "image/png" });
  const imageMarkdown = (count) => Array.from({ length: count }, () => {
    imageId += 1;
    return `![image_${imageId}](https://example.test/fake-${imageId}.png)`;
  }).join("\n\n");

  window.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target === "/api/runtime-config") {
      return new Response(JSON.stringify({ apiKeyConfigured: false, endpoints: ["https://good.test/v1"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (target === "/api/connection-test") {
      return new Response(JSON.stringify({ endpoint: "https://good.test/v1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (target === "/api/openai/chat-completions") {
      const body = JSON.parse(options.body || "{}");
      requests.push(body.payload);
      return new Response(JSON.stringify({ choices: [{ message: { content: "optimized prompt" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (target === "/api/render-jobs") {
      const body = JSON.parse(options.body || "{}");
      requests.push(body.payload);
      jobId += 1;
      const id = `job_${jobId}`;
      const count = Math.max(1, parseInt(body.payload?.n || 1, 10) || 1);
      jobs[id] = {
        id,
        traceId: `trace_${jobId}`,
        status: "completed",
        result: { endpoint: "https://good.test/v1", images: imageMarkdown(count).match(/https:\/\/example\.test\/fake-\d+\.png/g) || [] },
      };
      return new Response(JSON.stringify({ jobId: id, traceId: jobs[id].traceId, status: "queued" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }
    const jobMatch = target.match(/^\/api\/render-jobs\/(job_\d+)$/);
    if (jobMatch) {
      return new Response(JSON.stringify(jobs[jobMatch[1]]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (target.includes("/v1/models")) {
      return new Response(JSON.stringify({ data: [{ id: "gpt-image-2" }, { id: "gpt-5.4" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (target.startsWith("https://example.test/fake-")) {
      return new Response(pngBytes, { status: 200, headers: { "Content-Type": "image/png" } });
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  window.EventSource = class {
    constructor(url) {
      this.handlers = {};
      this.jobId = String(url).match(/render-jobs\/([^/]+)\/events/)?.[1];
      setTimeout(() => this.emitCompleted(), 0);
    }
    addEventListener(type, handler) { this.handlers[type] = handler; }
    close() {}
    emitCompleted() {
      this.handlers.job_event?.({ data: JSON.stringify({ type: "completed", jobId: this.jobId }) });
    }
  };

  async function run(name, fn) {
    try {
      await fn();
      ok(name);
    } catch (error) {
      bad(name, error);
    }
  }

  async function runImageFeature(name, setup, invoke, expected) {
    const before = requests.length;
    await run(name, async () => {
      await setup();
      await invoke();
      const sent = requests.slice(before).filter((body) => body.model === "gpt-image-2");
      if (!sent.length) throw new Error("no image request captured");
      const failed = expected(sent);
      if (failed) throw new Error(failed);
    });
  }

  localStorage.setItem("if_apikey", "test-key");
  await window.ImageForgeApi.loadRuntimeConfig();
  await new Promise((resolve) => setTimeout(resolve, 100));

  await run("设置弹窗与连接测试", async () => {
    openSettings();
    byId("setting-apikey").value = "test-key";
    await testConnection();
    if (!byId("conn-status").textContent.includes("连接正常")) throw new Error(byId("conn-status").textContent);
    closeSettings();
  });

  await runImageFeature("文字生图", async () => {
    switchTab("generate");
    byId("gen-prompt").value = "test image";
    byId("prompt-count").textContent = "10";
    document.querySelector("#generate-size-grid .size-btn[data-ratio='3:2']").click();
    document.querySelector("#tab-generate .quality-btn[data-quality='medium']").click();
  }, generateImage, (sent) => {
    const body = sent[0];
    if (body.size !== "1536x1024" || body.quality !== "medium" || body.n !== 1) return JSON.stringify(body);
    if (!byId("gen-result-img").src) return "missing result image";
    return "";
  });

  await runImageFeature("商品图批量生成", async () => {
    switchTab("product");
    uploads.product = [sampleFile()];
    renderMultiPreviews("product");
    byId("product-prompt").value = "clean product hero";
    byId("product-count").value = "6";
    document.querySelector("#product-size-grid .size-btn[data-ratio='2:3']").click();
    document.querySelector("#product-quality .quality-btn[data-quality='low']").click();
  }, () => generateNew("product"), (sent) => {
    const nValues = sent.map((body) => body.n).join(",");
    if (nValues !== "4,2") return `bad batches ${nValues}`;
    if (sent.some((body) => body.size !== "1024x1536" || body.quality !== "low")) return JSON.stringify(sent);
    return "";
  });

  await runImageFeature("风格复刻", async () => {
    switchTab("style");
    styleRefFile = sampleFile();
    uploads["style-prod"] = [sampleFile()];
    renderMultiPreviews("style-prod");
    byId("style-prompt").value = "premium poster";
  }, () => generateNew("style"), (sent) => {
    const parts = sent[0].messages[0].content;
    if (parts.filter((part) => part.type === "image_url").length < 2) return "missing reference/product images";
    return "";
  });

  await runImageFeature("服装基础套图", async () => {
    switchTab("clothing");
    uploads.clothing = [sampleFile()];
    uploads["clothing-model"] = [];
    renderMultiPreviews("clothing");
    byId("clothing-prompt").value = "white background";
  }, () => generateNew("clothing"), (sent) => {
    if (!sent[0].messages[0].content.some((part) => part.type === "image_url")) return "missing clothing image";
    return "";
  });

  await run("服装模特试穿 UI 切换", async () => {
    switchTab("clothing");
    document.querySelector("#clothing-mode-toggle .quality-btn:first-child").click();
    if (byId("clothing-model-section").style.display === "none") throw new Error("model section hidden");
    document.querySelector("#clothing-mode-toggle .quality-btn:last-child").click();
    if (byId("clothing-model-section").style.display !== "none") throw new Error("model section visible");
  });

  await runImageFeature("图片精修", async () => {
    switchTab("refine");
    uploads.refine = [sampleFile()];
    renderMultiPreviews("refine");
    byId("refine-prompt").value = "remove dust";
  }, () => generateNew("refine"), (sent) => {
    if (!sent[0].messages[0].content.some((part) => part.type === "image_url")) return "missing refine image";
    return "";
  });

  await runImageFeature("图片编辑", async () => {
    switchTab("edit");
    editSourceFile = sampleFile();
    maskSourceFile = sampleFile();
    byId("edit-prompt").value = "change background to blue";
    byId("edit-size").value = "3:2";
  }, editImage, (sent) => {
    const body = sent[0];
    if (body.size !== "1536x1024" || body.quality !== "high" || body.n !== 1) return JSON.stringify(body);
    const content = body.messages[0].content;
    if (content.filter((part) => part.type === "image_url").length !== 2) return "missing edit/reference images";
    if (!content.some((part) => String(part.text || "").includes("not a pixel-level mask"))) return "missing explicit soft-reference note";
    return "";
  });

  await run("AI 润色", async () => {
    switchTab("generate");
    byId("gen-prompt").value = "short";
    await polishGenPrompt();
    if (byId("gen-prompt").value !== "optimized prompt") throw new Error("prompt not replaced");
  });

  await run("反推提示词", async () => {
    switchTab("edit");
    editSourceFile = sampleFile();
    await reversePrompt();
    if (byId("edit-prompt").value !== "optimized prompt") throw new Error("reverse prompt not written");
  });

  await run("案例专区", async () => {
    switchTab("cases");
    await new Promise((resolve) => setTimeout(resolve, 50));
    const cards = document.querySelectorAll(".case-card").length;
    if (cards <= 0) throw new Error("no case cards");
  });

  await run("历史记录", async () => {
    const items = await getAllHistory();
    if (items.length <= 0) throw new Error("history is empty after generations");
    await clearAllHistory();
    const after = await getAllHistory();
    if (after.length !== 0) throw new Error("history not cleared");
  });

  return { results, requests };
})();
