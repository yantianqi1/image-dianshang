const assert = require("node:assert/strict");
const test = require("node:test");

const { createJobStore } = require("../jobs/store");
const { runRenderJob } = require("./service");

function createFixedStore() {
  return createJobStore({ idFactory: () => "job_x", traceFactory: () => "trace_x" });
}

test("runRenderJob completes a job with extracted images", async () => {
  const store = createFixedStore();
  const job = store.createJob({ feature: "generate" });

  await runRenderJob({
    apiKey: "test-key",
    jobId: job.id,
    payload: { model: "gpt-image-2", messages: [] },
    requestOpenAI: async () => ({
      data: { choices: [{ message: { content: "![image](https://cdn.test/final.png)" } }] },
      endpoint: "https://api.test/v1",
      status: 200,
    }),
    store,
  });

  const snapshot = store.getJob(job.id);
  assert.equal(snapshot.status, "completed");
  assert.deepEqual(snapshot.result.images, ["https://cdn.test/final.png"]);
  assert.equal(snapshot.result.endpoint, "https://api.test/v1");
});

test("runRenderJob fails with response summary when no image is returned", async () => {
  const store = createFixedStore();
  const job = store.createJob({ feature: "generate" });

  await runRenderJob({
    apiKey: "test-key",
    jobId: job.id,
    payload: { model: "gpt-image-2", messages: [] },
    requestOpenAI: async () => ({
      data: { choices: [{ message: { content: "text only" } }] },
      endpoint: "https://api.test/v1",
      status: 200,
    }),
    store,
  });

  const snapshot = store.getJob(job.id);
  assert.equal(snapshot.status, "failed");
  assert.equal(snapshot.error.code, "NO_IMAGE_DATA");
  assert.equal(snapshot.error.message, "API 未返回图片数据");
  assert.equal(snapshot.error.details.contentPreview, "text only");
});

