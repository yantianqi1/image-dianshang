const assert = require("node:assert/strict");
const test = require("node:test");

const { requestOpenAI } = require("./client");

test("requestOpenAI fails over endpoints and returns JSON response", async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith("https://bad.test")) {
      return new Response(JSON.stringify({ error: { message: "bad endpoint" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const response = await requestOpenAI({
    apiKey: "test-key",
    endpoints: ["https://bad.test/v1", "https://good.test/v1"],
    fetchImpl: fakeFetch,
    path: "/chat/completions",
    payload: { model: "gpt-5.4", messages: [] },
    traceId: "trace_a",
  });

  assert.deepEqual(calls, [
    "https://bad.test/v1/chat/completions",
    "https://good.test/v1/chat/completions",
  ]);
  assert.equal(response.endpoint, "https://good.test/v1");
  assert.equal(response.status, 200);
  assert.equal(response.data.choices[0].message.content, "OK");
});

