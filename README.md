# Codecov Coverage Fixer Prompt

A small Chrome (Manifest V3) extension that reads whatever Codecov pull
request or commit page you have open and turns the "missing coverage"
report into a ready-to-paste prompt for an AI coding agent (Claude,
GitHub Copilot, etc.) to go fix.

## What it does

1. You open a PR or commit page on `codecov.io` and switch to the
   "Files changed" tab.
2. Click the extension icon and hit **Generate prompt from this page**.
3. The extension scrapes:
   - The PR/commit title, status, branch, and GitHub link.
   - Overall HEAD / patch / change coverage percentages.
   - The list of changed files, sorted by number of missed lines, with
     each file's missed-line count and patch coverage.
   - The exact uncovered/partial line numbers for any file whose diff
     panel is currently expanded on the page (Codecov virtualizes the
     line-by-line view, so only lines actually rendered in the DOM can
     be read — expand a file first if you want its line numbers
     included).
4. It assembles all of that into a structured Markdown prompt and lets
   you copy it to your clipboard with one click, ready to hand to an AI
   coding agent.

Nothing is sent anywhere — everything runs locally in your browser.

## Installing (unpacked, for development/personal use)

1. Open `chrome://extensions` in Chrome (or any Chromium-based browser).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this folder.
4. Pin the extension, open a Codecov PR page, and click the icon.

## Files

- `manifest.json` — Manifest V3 configuration.
- `popup.html` / `popup.js` — the extension's popup UI and prompt
  builder.
- `scraper.js` — injected into the active Codecov tab via
  `chrome.scripting.executeScript` to read the page's DOM.
- `icons/` — toolbar icons.

## Permissions

- `activeTab` / `scripting` — to read the DOM of the Codecov tab you
  have open, only when you click the extension icon.
- `clipboardWrite` — to copy the generated prompt.
- Host permissions are limited to `codecov.io` and its subdomains
  (e.g. `app.codecov.io`).
