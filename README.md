# Sweden News Digest

A minimal, single-page news reader that aggregates English-language coverage of
Swedish **national politics and law** (with a focus on immigration, citizenship,
and work-permit rules) and **Gothenburg local news** — with sports and
entertainment excluded.

**Live site:** published via GitHub Pages from this repo (see the "About" section
on the repo page for the URL once Pages is enabled).

## How it works

This is a static site with no backend:

- [`scripts/fetch_news.py`](scripts/fetch_news.py) pulls topic-specific RSS
  feeds from [The Local Sweden](https://www.thelocal.se/) (politics,
  immigration, and Gothenburg), applies a sports/entertainment keyword filter
  as a safety net, and writes the result to `site/data/news.json`.
- A scheduled GitHub Actions workflow
  ([`update-news.yml`](.github/workflows/update-news.yml)) runs the fetch
  script every 2 hours and commits the refreshed JSON back to the repo.
- A second workflow ([`deploy-pages.yml`](.github/workflows/deploy-pages.yml))
  publishes the contents of `site/` to GitHub Pages whenever `main` changes or
  the news data is refreshed.
- [`site/index.html`](site/index.html) + [`site/assets/app.js`](site/assets/app.js)
  render the JSON as expandable/collapsible story cards, grouped by category,
  each linking out to the original article.

## Local development

```bash
# Regenerate the news data
python3 scripts/fetch_news.py

# Serve the site locally
cd site && python3 -m http.server 8000
# then open http://localhost:8000
```

## Adding or adjusting sources

Feeds and category labels are configured in the `FEEDS` dict at the top of
`scripts/fetch_news.py`. The `EXCLUDE_KEYWORDS` list is a secondary safety net
for filtering out sports/entertainment content that might slip into a topical
feed.

## License

MIT
