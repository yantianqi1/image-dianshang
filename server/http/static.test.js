const assert = require("node:assert/strict");
const test = require("node:test");

const { cacheControl } = require("./static");

test("mutable frontend assets are not cached", () => {
  assert.equal(cacheControl("/app/index.html"), "no-cache");
  assert.equal(cacheControl("/app/app.js"), "no-cache");
  assert.equal(cacheControl("/app/api-client.js"), "no-cache");
  assert.equal(cacheControl("/app/style.css"), "no-cache");
});

test("large static media can be cached", () => {
  assert.equal(cacheControl("/app/gallery-cases.js"), "public, max-age=604800");
  assert.equal(cacheControl("/app/logo.png"), "public, max-age=604800");
});

