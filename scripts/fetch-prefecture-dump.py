"""Cache target prefectural articles from Wikimedia's indexed multistream dump."""

import bz2
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "data/wiki-prefectures-index.txt.bz2"
CACHE = ROOT / "data/wiki-prefectures"
PROVINCE_CACHE = ROOT / "data/wiki-provinces"
DUMP = "https://dumps.wikimedia.org/zhwiki/latest/zhwiki-latest-pages-articles-multistream.xml.bz2"
USER_AGENT = "MapOfChinaResearch/0.1 (public data cache)"


def target_articles(refresh=False):
    official = json.loads((ROOT / "official-xzqh-2025.json").read_text())
    targets = {}
    for province in official["data"]["children"]:
        code = province["code"].ljust(6, "0") if province["code"].isdigit() else "710000"
        title = province["name"]
        aliases = {
            "香港特别行政区": "香港",
            "澳门特别行政区": "澳門",
            "台湾省": "臺灣省",
        }
        if refresh or not (PROVINCE_CACHE / f"{code}.json").exists():
            targets[aliases.get(title, title)] = (code, title, PROVINCE_CACHE, province["type"])
        for division in province.get("children") or []:
            if division["level"] != 2:
                continue
            code = division["code"].ljust(6, "0")
            cache = CACHE / f"{code}.json"
            if refresh or not cache.exists():
                targets[division["name"]] = (code, province["name"], CACHE, division["type"])
    return targets


def stream_positions(targets):
    offsets = {}
    ends = {}
    previous = None
    with bz2.open(INDEX, "rt", encoding="utf-8") as index:
        for line in index:
            offset_text, _, title = line.rstrip("\n").split(":", 2)
            offset = int(offset_text)
            if previous is not None and offset != previous and previous in offsets:
                ends[previous] = offset - 1
            if title in targets:
                offsets.setdefault(offset, set()).add(title)
            previous = offset
    if set(targets) != set().union(*offsets.values()):
        missing = set(targets) - set().union(*offsets.values())
        print(f"Titles absent from dump index: {sorted(missing)}", file=sys.stderr)
    if set(offsets) - set(ends):
        raise RuntimeError("Cannot determine final stream boundary")
    return offsets, ends


def read_stream(start, end):
    attempt = 0
    while True:
        request = urllib.request.Request(
            DUMP, headers={
                "Range": f"bytes={start}-{end}",
                "User-Agent": USER_AGENT,
                "Accept-Encoding": "identity",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                if response.status != 206:
                    raise RuntimeError(f"Expected byte range response, got HTTP {response.status}")
                return bz2.decompress(response.read())
        except urllib.error.HTTPError as error:
            if error.code == 429:
                print(f"HTTP 429 on stream {start}; waiting 300 seconds before retry", file=sys.stderr, flush=True)
                time.sleep(300)
                attempt = 0
                continue
            if attempt >= 2:
                raise RuntimeError(f"Failed stream at {start}: {error}") from error
            time.sleep(2 ** attempt)
        except (OSError, EOFError) as error:
            if attempt >= 2:
                raise RuntimeError(f"Failed stream at {start}: {error}") from error
            time.sleep(2 ** attempt)
        attempt += 1


def import_pages(xml_bytes, wanted, targets):
    found = set()
    for match in re.finditer(rb"<page>.*?</page>", xml_bytes, re.DOTALL):
        page = ET.fromstring(match.group())
        title = page.findtext("title")
        if title not in wanted:
            continue
        revision = page.find("revision")
        text = revision.findtext("text") if revision is not None else None
        if not text or text.lstrip().lower().startswith("#redirect") or text.lstrip().startswith("#重定向"):
            continue
        code, province, cache, division_type = targets[title]
        record = {
            "code": code,
            "name": province if cache == PROVINCE_CACHE else title,
            "province": province,
            "type": division_type,
            "title": title,
            "pageId": int(page.findtext("id")),
            "revisionId": int(revision.findtext("id")),
            "revisedAt": revision.findtext("timestamp"),
            "source": f"https://zh.wikipedia.org/wiki/{urllib.parse.quote(title)}",
            "license": "CC BY-SA 4.0",
            "wikitext": text,
        }
        (cache / f"{code}.json").write_text(json.dumps(record, ensure_ascii=False) + "\n")
        found.add(title)
    return found


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true", help="re-fetch already cached articles")
    parser.add_argument("--limit", type=int, help="maximum number of dump streams to fetch")
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    PROVINCE_CACHE.mkdir(parents=True, exist_ok=True)
    targets = target_articles(args.refresh)
    if not targets:
        print("All province and prefecture articles are already cached.")
        return
    offsets, ends = stream_positions(targets)
    limit = args.limit or len(offsets)
    complete = set()
    failures = []
    selected = sorted(offsets.items())[:limit]
    for index, (start, titles) in enumerate(selected, 1):
        try:
            found = import_pages(read_stream(start, ends[start]), titles, targets)
            complete.update(found)
            failures.extend(sorted(titles - found))
        except RuntimeError as error:
            failures.extend(sorted(titles))
            print(f"Stream {start}: {error}", file=sys.stderr)
        if index % 25 == 0 or index == len(selected):
            print(f"Read {index}/{len(selected)} streams, cached {len(complete)} articles", flush=True)
        time.sleep(1)
    if failures:
        print(f"Unresolved articles: {sorted(failures)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
