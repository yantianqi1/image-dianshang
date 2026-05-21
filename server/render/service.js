const { extractImages, summarizeImageResponse } = require("../images/extract");

async function runRenderJob(options) {
  const startedAt = Date.now();
  const { apiKey, jobId, payload, requestOpenAI, store } = options;
  store.updateStatus(jobId, "running");
  store.addEvent(jobId, "upstream_request", summarizePayload(payload));

  try {
    const response = await requestOpenAI({
      apiKey,
      path: "/chat/completions",
      payload,
      traceId: store.getJob(jobId).traceId,
    });
    const responseSummary = summarizeUpstreamResponse(response);
    store.addEvent(jobId, "upstream_response", responseSummary);
    return finishRenderJob({ jobId, response, responseSummary, startedAt, store });
  } catch (error) {
    return failRenderJob({ error, jobId, startedAt, store });
  }
}

function finishRenderJob(options) {
  const { jobId, response, responseSummary, startedAt, store } = options;
  const images = extractImages(response.data);
  store.addEvent(jobId, "image_parse", { count: images.length });
  if (!images.length) {
    const details = summarizeImageResponse(response.data);
    return store.failJob(jobId, {
      code: "NO_IMAGE_DATA",
      details: { ...responseSummary, ...details },
      message: "API 未返回图片数据",
      seconds: elapsedSeconds(startedAt),
    });
  }
  return store.completeJob(jobId, {
    endpoint: response.endpoint,
    images,
    response: responseSummary,
    seconds: elapsedSeconds(startedAt),
  });
}

function failRenderJob(options) {
  const { error, jobId, startedAt, store } = options;
  return store.failJob(jobId, {
    code: error.code || "RENDER_FAILED",
    details: error.details || {},
    message: error.message || String(error),
    seconds: elapsedSeconds(startedAt),
  });
}

function summarizePayload(payload) {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  return {
    imageInputs: countImageInputs(messages),
    maxTokens: payload?.max_tokens || null,
    model: payload?.model || "",
    n: payload?.n || null,
    quality: payload?.quality || "",
    size: payload?.size || "",
  };
}

function countImageInputs(messages) {
  let count = 0;
  for (const message of messages) {
    if (!Array.isArray(message?.content)) continue;
    count += message.content.filter((part) => part?.type === "image_url").length;
  }
  return count;
}

function summarizeUpstreamResponse(response) {
  return {
    endpoint: response.endpoint,
    response: summarizeImageResponse(response.data),
    status: response.status,
  };
}

function elapsedSeconds(startedAt) {
  return Number(((Date.now() - startedAt) / 1000).toFixed(3));
}

module.exports = { runRenderJob };

