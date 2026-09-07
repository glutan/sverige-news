#!/usr/bin/env python3
"""
Fetch and aggregate English-language Swedish news for the Sweden News Digest SPA.

Sources are RSS feeds already scoped to a topic (politics, immigration,
Gothenburg), so most filtering work is done by picking the right feed.
We still apply a keyword-based exclude list as a safety net against
sports/entertainment content that occasionally gets cross-tagged, and a
light dedupe pass across categories.

Output: data/news.json, consumed directly by the static frontend.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

USER_AGENT = "Mozilla/5.0 (compatible; SwedenNewsDigest/1.0; +https://github.com)"
REQUEST_TIMEOUT = 20
MAX_ITEMS_PER_CATEGORY = 25

# Category id -> (label, [feed urls])
FEEDS = {
    "politics": {
        "label": "National Politics & Law",
        "urls": [
            "https://feeds.thelocal.com/rss/se/politics",
        ],
    },
    "immigration": {
        "label": "Immigration & Citizenship",
        "urls": [
            "https://feeds.thelocal.com/rss/se/immigration",
        ],
    },
    "gothenburg": {
        "label": "Gothenburg Local News",
        "urls": [
            "https://feeds.thelocal.com/rss/se/gothenburg",
        ],
    },
}

# Safety-net exclusion: drop anything that looks like sports/entertainment
# even if it slipped into a topical feed.
EXCLUDE_KEYWORDS = [
    "football", "soccer", "ishockey", "hockey", "allsvenskan", "superettan",
    "handball", "world cup", "olympic", "olympics", "eurovision", "grand slam",
    "tennis", "golf", "formula 1", "f1 ", "nhl", "premier league", "champions league",
    "movie review", "film review", "album review", "tv review", "celebrity",
    "reality tv", "love island", "big brother", "melodifestivalen",
]

CATEGORY_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(raw: str) -> str:
    if not raw:
        return ""
    text = CATEGORY_TAG_RE.sub(" ", raw)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def fetch_feed(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        return resp.read()


def parse_pubdate(raw: str) -> str:
    if not raw:
        return datetime.now(timezone.utc).isoformat()
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError):
        return datetime.now(timezone.utc).isoformat()


def is_excluded(title: str, summary: str) -> bool:
    haystack = f"{title} {summary}".lower()
    return any(kw in haystack for kw in EXCLUDE_KEYWORDS)


def make_id(link: str, title: str) -> str:
    return hashlib.sha1(f"{link}|{title}".encode("utf-8")).hexdigest()[:16]


def parse_items(xml_bytes: bytes, source_name: str):
    items = []
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        print(f"  ! failed to parse XML from {source_name}: {exc}", file=sys.stderr)
        return items

    channel = root.find("channel")
    entries = channel.findall("item") if channel is not None else root.findall(".//item")

    for entry in entries:
        title = strip_html((entry.findtext("title") or "").strip())
        link = (entry.findtext("link") or "").strip()
        description = strip_html((entry.findtext("description") or "").strip())
        pub_date = parse_pubdate((entry.findtext("pubDate") or "").strip())

        if not title or not link:
            continue
        if is_excluded(title, description):
            continue

        # Trim overly long summaries for a clean collapsed/expanded card.
        summary = description
        if len(summary) > 500:
            summary = summary[:497].rsplit(" ", 1)[0] + "..."

        items.append(
            {
                "id": make_id(link, title),
                "title": title,
                "summary": summary,
                "link": link,
                "source": source_name,
                "published": pub_date,
            }
        )
    return items


def build_category(cat_id: str, cat_def: dict) -> dict:
    seen_ids = set()
    articles = []
    for url in cat_def["urls"]:
        print(f"  fetching {url}")
        try:
            xml_bytes = fetch_feed(url)
        except (urllib.error.URLError, TimeoutError) as exc:
            print(f"  ! could not fetch {url}: {exc}", file=sys.stderr)
            continue

        source_name = "The Local Sweden"
        for item in parse_items(xml_bytes, source_name):
            if item["id"] in seen_ids:
                continue
            seen_ids.add(item["id"])
            articles.append(item)

    articles.sort(key=lambda a: a["published"], reverse=True)
    articles = articles[:MAX_ITEMS_PER_CATEGORY]

    return {
        "id": cat_id,
        "label": cat_def["label"],
        "count": len(articles),
        "articles": articles,
    }


def main() -> int:
    print("Fetching Sweden news digest...")
    categories = []
    total = 0
    for cat_id, cat_def in FEEDS.items():
        print(f"Category: {cat_id}")
        category = build_category(cat_id, cat_def)
        total += category["count"]
        categories.append(category)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "categories": categories,
    }

    out_path = "site/data/news.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Wrote {out_path} with {total} articles across {len(categories)} categories.")

    if total == 0:
        print("Warning: zero articles fetched; keeping previous file would be safer,"
              " but writing anyway so CI failures are visible.", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
