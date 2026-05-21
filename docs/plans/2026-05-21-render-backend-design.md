# Render Backend Design

## Goal

Move image generation from browser-direct upstream calls to a small same-origin backend with async jobs, SSE progress, and structured diagnostics.

## Architecture

The browser creates a render job with `POST /api/render-jobs`. The backend returns a `jobId` immediately, runs the upstream `chat/completions` request in the background, and exposes progress through `GET /api/render-jobs/:id/events`. The browser can also fetch the final job snapshot with `GET /api/render-jobs/:id`.

The backend serves the existing static app and owns upstream endpoint probing, failover, response parsing, and structured logs. Every request gets a `traceId`; every job gets a `jobId`. Logs are written to stdout as JSON and kept on the job snapshot for browser diagnostics.

## Data Flow

1. Frontend builds the existing `gpt-image-2` payload.
2. Frontend posts `{ apiKey?, payload, feature }` to `/api/render-jobs`.
3. Backend selects an upstream endpoint from the pool.
4. Backend calls `/chat/completions` and records endpoint, status, elapsed time, and response shape.
5. Backend extracts image URLs/base64 data from known response shapes.
6. Backend marks the job as `completed` or `failed`.
7. Frontend receives SSE events and displays the result or a traceable error.

## Error Handling

No silent fallback is added for parse failures. If upstream returns HTTP success but no image data, the job fails with `API 未返回图片数据`, plus a response summary showing the actual JSON shape. Endpoint failover only happens for network or non-OK HTTP responses before the response is accepted.

## Security

API keys are never logged. If `IMAGEFORGE_API_KEY` is configured on the server, the frontend may omit the key. If not, the frontend can still send the user-entered key to the same-origin backend for compatibility.

## Runtime

Use Node built-in HTTP and fetch APIs to avoid dependency installation. The Docker image changes from nginx to Node and serves static files plus API endpoints from one process.

