(async () => {
  localStorage.setItem("if_apikey", "test-key");
  window.__capturedRequests = [];
  const imageBytes = Uint8Array.from(
    atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="),
    (char) => char.charCodeAt(0),
  );
  window.fetch = async (url, options = {}) => {
    if (String(url).includes("/v1/chat/completions")) {
      window.__capturedRequests.push(JSON.parse(options.body || "{}"));
      return new Response(JSON.stringify({
        choices: [{ message: { content: "![image_1](https://example.test/fake.png)" } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (String(url) === "https://example.test/fake.png") {
      return new Response(imageBytes, { status: 200, headers: { "Content-Type": "image/png" } });
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  document.querySelector("#gen-prompt").value = "test image";
  document.querySelector("#prompt-count").textContent = "10";
  document.querySelector("#generate-size-grid .size-btn[data-ratio='3:2']").click();
  document.querySelector("#tab-generate .quality-btn[data-quality='medium']").click();
  await window.generateImage();
  return window.__capturedRequests[0];
})();
