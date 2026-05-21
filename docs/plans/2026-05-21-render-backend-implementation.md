# Render Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a small Node backend that runs image jobs asynchronously, streams SSE diagnostics, and gives every failure enough structured context to find the failing layer.

**Architecture:** One Node process serves static files and `/api/*`. Render jobs live in an in-memory store; each job streams log events over SSE and writes JSON logs to stdout. Upstream endpoint selection remains server-side and parse failures fail explicitly.

**Tech Stack:** Node built-in `http`, `fs`, `path`, `crypto`, `node:test`, browser `EventSource`.

---

### Task 1: Response Parsing Tests

**Files:**
- Create: `server/images/extract.test.js`
- Create: `server/images/extract.js`

**Steps:**
1. Write tests for markdown image URLs, content-part `image_url`, `data[0].b64_json`, multiple markdown images, and no-image summaries.
2. Run `node --test server/images/extract.test.js` and verify it fails because implementation is missing.
3. Implement `extractImages()` and `summarizeImageResponse()`.
4. Re-run the test and verify it passes.

### Task 2: Job Store Tests

**Files:**
- Create: `server/jobs/store.test.js`
- Create: `server/jobs/store.js`

**Steps:**
1. Write tests for job creation, event recording, subscription replay, completion, and failure.
2. Run `node --test server/jobs/store.test.js` and verify it fails.
3. Implement the in-memory job store with explicit states.
4. Re-run the test and verify it passes.

### Task 3: Backend API

**Files:**
- Create: `server/main.js`
- Create: `server/config.js`
- Create: `server/http/router.js`
- Create: `server/http/static.js`
- Create: `server/upstream/client.js`
- Create: `server/upstream/endpoints.js`
- Create: `server/upstream/logging.js`
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`

**Steps:**
1. Add HTTP routing for health, runtime config, connection test, image job creation, job snapshot, SSE events, and sync chat-completions proxy.
2. Add upstream request code with endpoint failover and redacted structured logs.
3. Add static file serving for existing frontend assets.
4. Run `node --check` on all server files.

### Task 4: Frontend Integration

**Files:**
- Modify: `api-client.js`
- Modify: `app.js`
- Modify: `index.html`
- Modify: `style.css`

**Steps:**
1. Replace browser-direct OpenAI fetch with same-origin backend calls.
2. Route image generation through async jobs and SSE event listening.
3. Keep AI polish and reverse prompt routed through backend proxy.
4. Add traceId/jobId details to user-facing errors and browser diagnostics.

### Task 5: Verification

**Files:**
- Modify: `qa/browser_feature_probe.js`
- Modify: `qa/payload_probe.js`
- Modify: `功能测试记录.md`
- Modify: `README.md`

**Steps:**
1. Update browser probes for backend job API behavior.
2. Run `node --test server/**/*.test.js`.
3. Run `node --check api-client.js app.js gallery-cases.js server/main.js`.
4. Start the server and smoke test `/api/health`, static `/`, and a mocked render job path where possible.

