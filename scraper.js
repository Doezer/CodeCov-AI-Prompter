/**
 * Runs inside the Codecov tab via chrome.scripting.executeScript.
 * Must be fully self-contained (no references to outer-scope variables) and
 * must return a plain, JSON-serializable object.
 *
 * Best-effort scraper: Codecov's DOM is virtualized (react-window style) for
 * line-by-line diffs, so uncovered line numbers can only be read for file
 * panels the user has actually expanded/scrolled into view. Everything else
 * (file list, missed-line counts, coverage percentages) comes straight from
 * the always-rendered summary table, so it is reliable regardless of scroll
 * position.
 */
function scrapeCodecovPage() {
  function text(el) {
    return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
  }

  function numberValue(container) {
    if (!container) return "";
    const el = container.querySelector('[data-testid="number-value"]');
    return text(el);
  }

  const result = {
    url: location.href,
    scrapedAt: new Date().toISOString(),
    owner: "",
    repo: "",
    kind: "",
    number: "",
    title: "",
    status: "",
    branch: "",
    githubUrl: "",
    headCommit: "",
    baseCommit: "",
    stats: { head: "", patch: "", change: "" },
    tabs: {},
    files: [],
    warnings: []
  };

  // --- Breadcrumb: owner / repo / pulls|commits / number ---
  const ownerLink = document.querySelector('a[data-cy="owner"]');
  const repoLink = document.querySelector('a[data-cy="repo"]');
  result.owner = text(ownerLink);
  result.repo = text(repoLink);

  const pullsLink = document.querySelector('a[data-cy="pulls"]');
  const commitsLink = document.querySelector('a[data-cy="commits"]');
  if (pullsLink) {
    result.kind = "pull";
  } else if (commitsLink) {
    result.kind = "commit";
  }

  // Breadcrumb nav's last plain <span> is usually the PR/commit number.
  const breadcrumbNav = ownerLink ? ownerLink.closest("nav") : null;
  if (breadcrumbNav) {
    const spans = Array.from(breadcrumbNav.querySelectorAll(":scope > span"));
    if (spans.length) {
      result.number = text(spans[spans.length - 1]);
    }
  }

  // --- Title / status badge ---
  const h1 = document.querySelector("h1");
  if (h1) {
    const badge = h1.querySelector("span");
    result.status = text(badge);
    const clone = h1.cloneNode(true);
    const badgeInClone = clone.querySelector("span");
    if (badgeInClone) badgeInClone.remove();
    result.title = text(clone);
  }

  // --- GitHub PR/commit link + branch name ---
  const prLink = document.querySelector('a[data-cy="provider-pr-link"]');
  if (prLink) {
    result.githubUrl = prLink.href || "";
    const infoParagraph = prLink.closest("p");
    if (infoParagraph) {
      const spans = Array.from(
        infoParagraph.querySelectorAll(":scope > span")
      );
      // The branch name (when present) is rendered as a trailing
      // "<span class='flex items-center'>...branch-name</span>" sibling.
      for (let i = spans.length - 1; i >= 0; i--) {
        const t = text(spans[i]);
        if (t && t !== "CI Passed" && t !== "CI Failed" && !/^#/.test(t)) {
          result.branch = t;
          break;
        }
      }
    }
  }

  // --- HEAD / Patch / Change stat tiles + base/head commit source line ---
  const statBlocks = Array.from(
    document.querySelectorAll(".flex.flex-col.justify-center.gap-1")
  );
  for (const block of statBlocks) {
    const label = text(block.querySelector("h4"));
    if (/^HEAD$/i.test(label)) {
      result.stats.head = numberValue(block);
    } else if (/^Patch$/i.test(label)) {
      result.stats.patch = numberValue(block);
    } else if (/^Change$/i.test(label)) {
      result.stats.change = numberValue(block);
    } else if (/^Source$/i.test(label)) {
      const commitLinks = Array.from(
        block.querySelectorAll('a[data-cy="commit"]')
      );
      if (commitLinks.length >= 1) result.headCommit = text(commitLinks[0]);
      if (commitLinks.length >= 2) result.baseCommit = text(commitLinks[1]);
    }
  }

  // --- Tab counters (Files changed, Indirect changes, Commits, Flags, Components) ---
  const tabSelectors = {
    filesChanged: 'a[data-cy="pullDetail"], a[data-cy="commitDetail"]',
    indirectChanges: 'a[data-cy="pullIndirectChanges"], a[data-cy="commitIndirectChanges"]',
    commits: 'a[data-cy="pullCommits"]',
    flags: 'a[data-cy="pullFlags"], a[data-cy="commitFlags"]',
    components: 'a[data-cy="pullComponents"], a[data-cy="commitComponents"]'
  };
  for (const [key, selector] of Object.entries(tabSelectors)) {
    const link = document.querySelector(selector);
    if (link) {
      const sup = link.querySelector("sup");
      result.tabs[key] = text(sup);
    }
  }

  // --- File list rows ---
  const rows = Array.from(
    document.querySelectorAll('[data-testid="file-diff-expand"]')
  );

  if (!rows.length) {
    result.warnings.push(
      "No file rows found. Make sure you're on a Codecov pull request or commit page with the 'Files changed' tab open."
    );
  }

  for (const row of rows) {
    const nameEl = row.querySelector(".flex.flex-row.items-center.break-all");
    const fileName = text(nameEl);
    if (!fileName) continue;

    const numericCols = Array.from(
      row.querySelectorAll('[data-type="numeric"]')
    );
    const missedLines = numericCols[0] ? numberValueOrDash(numericCols[0]) : "";
    const headPct = numericCols[1] ? numberValueOrDash(numericCols[1]) : "";
    const patchPct = numericCols[2] ? numberValueOrDash(numericCols[2]) : "";
    const changePct = numericCols[3] ? numberValueOrDash(numericCols[3]) : "";

    // If this row's diff panel is currently expanded and rendered, try to
    // read the uncovered/partial line numbers that are actually in the DOM
    // right now (virtualization means off-screen lines won't be present).
    let uncoveredLines = [];
    let panel = row.nextElementSibling;
    if (panel && panel.getAttribute("data-expanded") === "true") {
      const icons = Array.from(
        panel.querySelectorAll('[data-testid="missing-coverage-icon"]')
      );
      for (const icon of icons) {
        const lineRow = icon.closest(".flex.items-center.justify-between");
        if (!lineRow) continue;
        const spans = lineRow.querySelectorAll("span");
        const lineNumSpan = spans[spans.length - 1];
        const lineNum = text(lineNumSpan);
        if (lineNum && /^\d+$/.test(lineNum)) {
          uncoveredLines.push(parseInt(lineNum, 10));
        }
      }
    }
    uncoveredLines = Array.from(new Set(uncoveredLines)).sort((a, b) => a - b);

    result.files.push({
      name: fileName,
      missedLines,
      headPct,
      patchPct,
      changePct,
      uncoveredLines
    });
  }

  function numberValueOrDash(container) {
    const el = container.querySelector('[data-testid="number-value"]');
    if (el) return text(el);
    const t = text(container);
    return t === "-" ? "" : t;
  }

  return result;
}
