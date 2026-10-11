# KOREA TALENT GATE

Static bilingual MVP for global talent and Korean companies. No build tools or dependencies are required.

## Structure

```text
index.html                 # Relative redirect to English Home
assets/css/styles.css      # Shared responsive styles
assets/js/main.js          # Mobile navigation and footer year
en/index.html             # English Home
kr/index.html             # Korean Home
vi/.gitkeep               # Reserved Vietnamese locale (not published yet)
```

## Local development

From the existing checkout (no additional Git worktree needed):

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `/en/` or `/kr/` using your local browser. Check both pages at desktop 1280px and mobile 375px. The root redirects to `./en/`.

## GitHub Pages

Publish this repository root through GitHub Pages (branch `main`, folder `/ (root)`) after reviewing and committing the site separately. No build is needed. All asset and locale URLs are relative, supporting `/korea-talent-gate/` as well as a custom domain. Add a `CNAME` only after a domain is chosen and its DNS is configured.

Navigation currently links to sections on Home. Detailed pages, Vietnamese content, live job listings, accounts, matching, and contact submission are not implemented. Vietnamese is visibly unavailable in the language selector. The content hub shows noninteractive cards explicitly marked as in development. Home contains no personal-data form or network submission.
