# Codecov Coverage Fixer Prompt

A small Chrome (Manifest V3) extension that reads the Codecov pull request or
commit page you have open and turns its "missing coverage" report into a
ready-to-paste prompt for an AI coding agent (Claude, GitHub Copilot, etc.) to
go fix.

No build step, no dependencies, no accounts: load the folder unpacked and click
the icon.

## What it does

1. Open a pull request or commit page on `codecov.io` and switch to the
   **Files changed** tab.
2. Click the extension icon, then **Generate prompt from this page**.
3. The extension reads, straight from the page you are looking at:
   - the PR or commit title, CI status, branch name and link back to GitHub;
   - the head and base commit it is comparing;
   - the overall HEAD, patch and change coverage percentages;
   - every changed file with its missed-line count and its head, patch and
     change coverage;
   - the exact uncovered and partially covered line numbers for any file whose
     diff panel is currently expanded on the page.
4. It assembles that into a structured Markdown prompt — context, the files
   ranked by missed lines, then a numbered task list telling the agent to add
   tests rather than to weaken the code — and shows it in the popup.
5. Click **Copy prompt to clipboard** and paste it into your agent.

### Privacy

Everything runs locally in your browser. The extension has no backend, makes no
network requests of its own, and sends nothing anywhere. The only data it
touches is the DOM of the Codecov tab you explicitly click it on.

## Requirements

- Chrome, Edge, Brave or another Chromium-based browser with Manifest V3
  support.
- A `codecov.io` page (including `app.codecov.io`). Self-hosted Codecov
  instances on other domains are not matched by the host permissions and will
  not work without editing `manifest.json`.

Only Chromium browsers have been tested. The popup calls the `chrome.*`
extension APIs directly, so Firefox is untested and unsupported for now.

## Install

### From a release zip

1. Download the latest zip from [Releases](../../releases).
2. Unzip it somewhere you will keep it — Chrome loads the extension from that
   folder every start-up, so don't unzip it into a temp directory.
3. Open `chrome://extensions`, enable **Developer mode** (top-right toggle),
   click **Load unpacked** and select the extracted folder.

In PowerShell:

```powershell
Expand-Archive -Path "$HOME\Downloads\codecov-coverage-fixer-prompt-v1.0.zip" -DestinationPath "$HOME\extensions\codecov-coverage-fixer-prompt"
```

### From source

```powershell
git clone https://github.com/Doezer/CodeCov-AI-Prompter.git
```

Then **Load unpacked** the cloned folder as above.

After loading, pin the extension so the icon stays visible, open a Codecov pull
request page and click it.

## Known limitations

- **Expand a file's diff to get its line numbers.** Codecov's line-by-line view
  is virtualised, so only the rows actually rendered in the page can be read.
  The file list, missed-line counts and coverage percentages come from the
  always-rendered summary table and are reliable regardless of scrolling; exact
  line numbers are only captured for panels you have expanded. The generated
  prompt tells the agent when line numbers are missing.
- **Codecov's DOM is not a public API.** The scraper matches Codecov's current
  `data-testid` and `data-cy` attributes. If Codecov redesigns its pages the
  selectors in `scraper.js` need updating — the popup will report that it found
  no file rows.
- The extension reads only the page you have open; it does not call the Codecov
  API, so it cannot see files or lines that are not on that page.

## Repository layout

| Path | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 configuration. |
| `popup.html` / `popup.js` | The popup UI and the `buildPrompt` prompt builder. |
| `scraper.js` | Injected into the active Codecov tab via `chrome.scripting.executeScript` to read the page's DOM. |
| `icons/` | Toolbar icons. |
| `scripts/validate-extension.mjs` | Sanity checks on the extension's shape, also run in CI. |
| `AGENTS.md` | Guidance for AI coding agents working in this repo. |

## Permissions, and why each is needed

| Permission | Why |
| --- | --- |
| `activeTab` + `scripting` | To read the DOM of the Codecov tab, only after you click the extension icon. |
| `clipboardWrite` | To copy the generated prompt. |
| Host permissions | Limited to `codecov.io` and its subdomains. The popup also refuses to run on any other host. |

## Development

There is no build and no `node_modules`; the files in the repository are the
extension. Node.js 24 is what CI uses, but any recent Node runs the checks.

Run the same checks CI does before opening a pull request:

```powershell
node --check popup.js
node --check scraper.js
node scripts/validate-extension.mjs
```

Then reload the unpacked extension in `chrome://extensions` and exercise the
popup against a real Codecov pull request page — the validator checks the
extension's shape, not its selectors.

`.github/workflows/ci.yml` runs those three commands on every push to `main`
and every pull request.

### Releasing

Push a `v*` tag (or run the workflow manually) and
`.github/workflows/release.yml` validates the extension, packages
`manifest.json`, `popup.html`, `popup.js`, `scraper.js`, `icons/` and
`README.md` into `codecov-coverage-fixer-prompt-<tag>.zip`, and attaches it to
the GitHub release.

## Contributing

Bug reports and feature requests are welcome — the issue templates under
[`.github/ISSUE_TEMPLATE`](.github/ISSUE_TEMPLATE) will prompt you for what is
needed. Selector fixes after a Codecov redesign are especially useful: pull
requests are very welcome.
