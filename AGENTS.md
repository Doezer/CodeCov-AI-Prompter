# Agent Guidance

## Project Shape
- This repo is a small Chrome extension (Manifest V3) that turns a Codecov PR/commit page into an AI-agent prompt for fixing missing coverage.
- The main files are `manifest.json`, `popup.html`, `popup.js`, `scraper.js`, `icons/`, and `README.md`.
- Keep changes focused on those files unless a new dependency or asset is truly required.

## How It Works
- `popup.js` queries the active tab, requires a `codecov.io` page, injects `scraper.js` via `chrome.scripting.executeScript`, then calls `scrapeCodecovPage()` to read the page.
- `scraper.js`'s `scrapeCodecovPage` must stay self-contained (no references to outer-scope variables) because it runs inside the Codecov page context, not the popup's.
- `popup.js`'s `buildPrompt` turns the scraped data into the Markdown prompt shown in the popup.
- Any change to permissions or target sites must stay aligned between `manifest.json`, `popup.js`'s `isCodecovUrl` guard, and `scraper.js`'s selectors.

## Editing Rules
- Prefer minimal, direct changes over framework-style abstractions.
- Preserve the current no-build setup unless a new build step is explicitly needed.
- Keep the popup accessible: ensure `popup.html` keeps a document title and labeled controls.

## Validation
- `node --check popup.js` and `node --check scraper.js` for syntax.
- `node scripts/validate-extension.mjs` for extension-shape sanity checks (also run in CI).
- Recheck the extension by loading it unpacked in Chrome and exercising the popup on a real Codecov pull request page.
- Verify DOM selectors in `scraper.js` against the current Codecov page structure after edits — Codecov's diff view is virtualized, so only rendered rows are readable.

## Documentation
- Use `README.md` for user-facing setup or usage notes.
- Link to docs instead of copying them into agent instructions when more detail is needed.
