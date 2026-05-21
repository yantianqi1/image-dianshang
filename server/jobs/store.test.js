const assert = require("node:assert/strict");
const test = require("node:test");

const { createJobStore } = require("./store");

test("job store records creation and log events", () => {
  const store = createJobStore({ idFactory: () => "job_a", traceFactory: () => "trace_a" });
  const job = store.createJob({ feature: "generate" });

  store.addEvent(job.id, "upstream_request", { endpoint: "https://api.test/v1" });

  const snapshot = store.getJob(job.id);
  assert.equal(snapshot.id, "job_a");
  assert.equal(snapshot.traceId, "trace_a");
  assert.equal(snapshot.status, "queued");
  assert.equal(snapshot.events.length, 2);
  assert.equal(snapshot.events[1].type, "upstream_request");
});

test("job store replays events to subscribers", () => {
  const store = createJobStore({ idFactory: () => "job_b", traceFactory: () => "trace_b" });
  const job = store.createJob({ feature: "edit" });
  const received = [];

  const unsubscribe = store.subscribe(job.id, (event) => received.push(event));
  store.addEvent(job.id, "heartbeat", { status: "running" });
  unsubscribe();
  store.addEvent(job.id, "ignored_after_unsubscribe", {});

  assert.deepEqual(received.map((event) => event.type), ["created", "heartbeat"]);
});

test("job store marks completed jobs with result", () => {
  const store = createJobStore({ idFactory: () => "job_c", traceFactory: () => "trace_c" });
  const job = store.createJob({ feature: "product" });

  store.completeJob(job.id, { images: ["https://cdn.test/final.png"] });

  const snapshot = store.getJob(job.id);
  assert.equal(snapshot.status, "completed");
  assert.deepEqual(snapshot.result.images, ["https://cdn.test/final.png"]);
  assert.equal(snapshot.events.at(-1).type, "completed");
});

test("job store marks failed jobs with structured error", () => {
  const store = createJobStore({ idFactory: () => "job_d", traceFactory: () => "trace_d" });
  const job = store.createJob({ feature: "style" });

  store.failJob(job.id, {
    message: "API 未返回图片数据",
    code: "NO_IMAGE_DATA",
    details: { contentKind: "string" },
  });

  const snapshot = store.getJob(job.id);
  assert.equal(snapshot.status, "failed");
  assert.equal(snapshot.error.code, "NO_IMAGE_DATA");
  assert.equal(snapshot.error.details.contentKind, "string");
  assert.equal(snapshot.events.at(-1).type, "failed");
});

