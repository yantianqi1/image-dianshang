const assert = require("node:assert/strict");
const test = require("node:test");

const { extractImages, summarizeImageResponse } = require("./extract");

test("extractImages returns markdown image URLs from chat content", () => {
  const data = {
    choices: [{ message: { content: "Done\n![image](https://cdn.test/a.png)" } }],
  };

  assert.deepEqual(extractImages(data), ["https://cdn.test/a.png"]);
});

test("extractImages returns image_url parts from array content", () => {
  const data = {
    choices: [{
      message: {
        content: [
          { type: "text", text: "ready" },
          { type: "image_url", image_url: { url: "https://cdn.test/b.png" } },
        ],
      },
    }],
  };

  assert.deepEqual(extractImages(data), ["https://cdn.test/b.png"]);
});

test("extractImages returns legacy b64_json data", () => {
  const data = { data: [{ b64_json: "abc123" }] };

  assert.deepEqual(extractImages(data), ["data:image/png;base64,abc123"]);
});

test("extractImages returns all markdown images", () => {
  const data = {
    choices: [{
      message: {
        content: "![one](https://cdn.test/1.png)\n![two](https://cdn.test/2.png)",
      },
    }],
  };

  assert.deepEqual(extractImages(data), [
    "https://cdn.test/1.png",
    "https://cdn.test/2.png",
  ]);
});

test("summarizeImageResponse exposes no-image response shape", () => {
  const data = {
    id: "chatcmpl_x",
    choices: [{ message: { content: "I cannot generate that image." } }],
  };

  assert.deepEqual(summarizeImageResponse(data), {
    topLevelKeys: ["choices", "id"],
    choicesCount: 1,
    contentKind: "string",
    contentPreview: "I cannot generate that image.",
    dataCount: 0,
  });
});

