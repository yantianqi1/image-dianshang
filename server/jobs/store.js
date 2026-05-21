const { randomUUID } = require("node:crypto");

function createJobStore(options = {}) {
  const jobs = new Map();
  const listeners = new Map();
  const eventSink = options.eventSink || (() => {});
  const idFactory = options.idFactory || (() => `job_${randomUUID()}`);
  const traceFactory = options.traceFactory || (() => `tr_${randomUUID()}`);

  function createJob(metadata = {}) {
    const now = new Date().toISOString();
    const job = {
      id: idFactory(),
      traceId: traceFactory(),
      status: "queued",
      metadata: { ...metadata },
      events: [],
      createdAt: now,
      updatedAt: now,
      result: null,
      error: null,
    };
    jobs.set(job.id, job);
    emit(job.id, makeEvent(job, "created", metadata));
    return cloneJob(job);
  }

  function getJob(id) {
    const job = jobs.get(id);
    return job ? cloneJob(job) : null;
  }

  function addEvent(id, type, data = {}) {
    const job = requireJob(jobs, id);
    return emit(id, makeEvent(job, type, data));
  }

  function updateStatus(id, status) {
    const job = requireJob(jobs, id);
    job.status = status;
    job.updatedAt = new Date().toISOString();
    return cloneJob(job);
  }

  function completeJob(id, result) {
    const job = requireJob(jobs, id);
    job.status = "completed";
    job.result = result;
    job.updatedAt = new Date().toISOString();
    emit(id, makeEvent(job, "completed", result));
    return cloneJob(job);
  }

  function failJob(id, error) {
    const job = requireJob(jobs, id);
    job.status = "failed";
    job.error = { ...error };
    job.updatedAt = new Date().toISOString();
    emit(id, makeEvent(job, "failed", job.error));
    return cloneJob(job);
  }

  function subscribe(id, handler) {
    const job = requireJob(jobs, id);
    const set = listeners.get(id) || new Set();
    listeners.set(id, set);
    set.add(handler);
    job.events.forEach(handler);
    return () => set.delete(handler);
  }

  function emit(id, event) {
    const job = requireJob(jobs, id);
    job.events.push(event);
    job.updatedAt = event.at;
    eventSink(event);
    for (const listener of listeners.get(id) || []) listener(event);
    return event;
  }

  return { addEvent, completeJob, createJob, failJob, getJob, subscribe, updateStatus };
}

function makeEvent(job, type, data) {
  return {
    at: new Date().toISOString(),
    data: data && typeof data === "object" ? { ...data } : data,
    jobId: job.id,
    traceId: job.traceId,
    type,
  };
}

function cloneJob(job) {
  return JSON.parse(JSON.stringify(job));
}

function requireJob(jobs, id) {
  const job = jobs.get(id);
  if (!job) throw new Error(`Unknown job: ${id}`);
  return job;
}

module.exports = { createJobStore };
