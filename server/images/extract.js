const HTTP_IMAGE_MARKDOWN_RE = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;

function extractImages(data) {
  const fromChoices = extractChoiceImages(data);
  if (fromChoices.length) return fromChoices;
  return extractLegacyImages(data);
}

function extractChoiceImages(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) return extractContentPartImages(content);
  if (typeof content === "string") return extractMarkdownImages(content);
  return [];
}

function extractContentPartImages(parts) {
  const images = [];
  for (const part of parts) {
    if (part?.type === "image_url" && part.image_url?.url) images.push(part.image_url.url);
    if (part?.type === "text" && part.text) images.push(...extractMarkdownImages(part.text));
  }
  return images;
}

function extractMarkdownImages(text) {
  return [...String(text || "").matchAll(HTTP_IMAGE_MARKDOWN_RE)].map((match) => match[1]);
}

function extractLegacyImages(data) {
  if (!Array.isArray(data?.data)) return [];
  return data.data.map((item) => {
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    return item?.url || "";
  }).filter(Boolean);
}

function summarizeImageResponse(data) {
  const content = data?.choices?.[0]?.message?.content;
  const summary = {
    topLevelKeys: Object.keys(data || {}).sort(),
    choicesCount: Array.isArray(data?.choices) ? data.choices.length : 0,
    contentKind: contentKind(content),
    dataCount: Array.isArray(data?.data) ? data.data.length : 0,
  };
  const preview = contentPreview(content);
  if (preview) summary.contentPreview = preview;
  return summary;
}

function contentKind(content) {
  if (Array.isArray(content)) return "array";
  if (content === null) return "null";
  return typeof content;
}

function contentPreview(content) {
  if (typeof content === "string") return content.slice(0, 240);
  if (!Array.isArray(content)) return "";
  return content.map((part) => part?.type || typeof part).join(",");
}

module.exports = { extractImages, summarizeImageResponse };

