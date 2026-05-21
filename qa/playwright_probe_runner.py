import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: playwright_probe_runner.py <url> <probe.js>", file=sys.stderr)
        return 2
    url = sys.argv[1]
    probe = Path(sys.argv[2]).read_text(encoding="utf-8")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle")
        result = page.evaluate(probe)
        browser.close()

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

