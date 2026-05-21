const fs = require("node:fs");
const path = require("node:path");

const CONTENT_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
});

async function serveStatic(req, res, staticRoot) {
  const filePath = resolveStaticPath(req.url, staticRoot);
  if (!filePath) return sendStatus(res, 403);
  const finalPath = await existingFileOrFallback(filePath, staticRoot);
  if (!finalPath) return sendStatus(res, 404);
  sendFile(res, finalPath);
}

function resolveStaticPath(rawUrl, staticRoot) {
  const pathname = new URL(rawUrl, "http://local").pathname;
  const requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const resolved = path.resolve(staticRoot, `.${requested}`);
  return resolved.startsWith(staticRoot) ? resolved : "";
}

async function existingFileOrFallback(filePath, staticRoot) {
  if (await isFile(filePath)) return filePath;
  if (path.extname(filePath)) return "";
  const fallback = path.join(staticRoot, "index.html");
  return (await isFile(fallback)) ? fallback : "";
}

async function isFile(filePath) {
  try {
    return (await fs.promises.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function sendFile(res, filePath) {
  res.writeHead(200, {
    "Cache-Control": cacheControl(filePath),
    "Content-Type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(res);
}

function cacheControl(filePath) {
  const mutableAssets = new Set(["index.html", "app.js", "api-client.js", "style.css"]);
  return mutableAssets.has(path.basename(filePath)) ? "no-cache" : "public, max-age=604800";
}

function sendStatus(res, status) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(String(status));
}

module.exports = { cacheControl, serveStatic };
