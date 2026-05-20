import base64
import json
import os
import re
import struct
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


API_BASE = os.environ.get("IMAGEFORGE_API_BASE", "https://api2.opcl.cloud").rstrip("/")
API_KEY = os.environ.get("IMAGEFORGE_API_KEY", "").strip()
OUT_DIR = Path("dogfood-output/api-smoke")
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)
SAMPLE_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
)


def request_json(method, path, body=None, timeout=300):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        API_BASE + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        return resp.status, json.loads(raw.decode("utf-8"))


def record(results, name, ok, **details):
    results.append({"name": name, "ok": ok, **details})


def api_error(error):
    if isinstance(error, urllib.error.HTTPError):
        body = error.read().decode("utf-8", errors="replace")
        return f"HTTP {error.code}: {body[:500]}"
    return str(error)


def chat_image_urls(data):
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return re.findall(r"!\[.*?\]\((https?://[^\s)]+)\)", content)


def download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": "ImageForge smoke test"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        path.write_bytes(resp.read())


def png_dimensions(path):
    with path.open("rb") as handle:
        header = handle.read(24)
    if header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a png file")
    return struct.unpack(">II", header[16:24])


def sample_image_data_url():
    return f"data:image/png;base64,{SAMPLE_PNG_BASE64}"


def run():
    if not API_KEY:
        print("IMAGEFORGE_API_KEY is required", file=sys.stderr)
        return 2
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = []

    try:
        status, data = request_json("GET", "/v1/models", timeout=30)
        models = [item.get("id") for item in data.get("data", [])]
        record(results, "models", status == 200 and bool(models), count=len(models), sample=models[:5])
    except Exception as error:
        record(results, "models", False, error=api_error(error))

    try:
        _, data = request_json("POST", "/v1/chat/completions", {
            "model": "gpt-5.4",
            "messages": [{"role": "user", "content": "Return exactly: OK"}],
            "max_tokens": 32,
        }, timeout=120)
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        record(results, "text_chat_gpt_5_4", bool(content.strip()), content=content[:120])
    except Exception as error:
        record(results, "text_chat_gpt_5_4", False, error=api_error(error))

    image_jobs = [
        ("txt2img_landscape", {
            "model": "gpt-image-2",
            "messages": [{"role": "user", "content": "Simple product photo of a white ceramic cup, no text."}],
            "size": "1536x1024",
            "quality": "low",
            "n": 1,
            "max_tokens": 4096,
        }),
        ("img_input_edit", {
            "model": "gpt-image-2",
            "messages": [{"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": sample_image_data_url()}},
                {"type": "text", "text": "Keep the object, change the background to pale blue, no text."},
            ]}],
            "size": "1024x1024",
            "quality": "low",
            "n": 1,
            "max_tokens": 4096,
        }),
    ]

    for name, payload in image_jobs:
        started = time.time()
        try:
            _, data = request_json("POST", "/v1/chat/completions", payload, timeout=300)
            urls = chat_image_urls(data)
            if not urls:
                record(results, name, False, error="no image url returned", response=data)
                continue
            image_path = OUT_DIR / f"{name}.png"
            download(urls[0], image_path)
            width, height = png_dimensions(image_path)
            record(results, name, True, url=urls[0], file=str(image_path), width=width, height=height, seconds=round(time.time() - started, 2))
        except Exception as error:
            record(results, name, False, error=api_error(error), seconds=round(time.time() - started, 2))

    output = {"api_base": API_BASE, "results": results}
    result_path = OUT_DIR / "results.json"
    result_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0 if all(item["ok"] for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(run())
