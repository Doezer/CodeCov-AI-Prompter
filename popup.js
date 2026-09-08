const generateBtn = document.getElementById("generate");
const copyBtn = document.getElementById("copy");
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");

function setStatus(message, kind) {
  statusEl.textContent = message || "";
  statusEl.className = kind || "";
}

function pluralize(n, singular, plural) {
  return n === 1 ? singular : plural || singular + "s";
}

function buildPrompt(data) {
  const lines = [];

  const repoLabel =
    data.owner && data.repo ? `${data.owner}/${data.repo}` : "this repository";
  const subject =
    data.kind === "commit"
      ? `commit ${data.number || ""}`.trim()
      : `pull request #${data.number || "?"}`;

  lines.push(
    `Fix the missing test coverage reported by Codecov for ${subject} in ${repoLabel}.`
  );
  lines.push("");
  lines.push("## Context");
  if (data.title) lines.push(`- Title: ${data.title}`);
  if (data.status) lines.push(`- Status: ${data.status}`);
  if (data.branch) lines.push(`- Branch: ${data.branch}`);
  if (data.githubUrl) lines.push(`- GitHub link: ${data.githubUrl}`);
  if (data.headCommit || data.baseCommit) {
    lines.push(
      `- Comparing head ${data.headCommit || "?"} against base ${
        data.baseCommit || "?"
      }`
    );
  }
  const statParts = [];
  if (data.stats.head) statParts.push(`HEAD coverage ${data.stats.head}`);
  if (data.stats.patch) statParts.push(`patch coverage ${data.stats.patch}`);
  if (data.stats.change) statParts.push(`change ${data.stats.change}`);
  if (statParts.length) lines.push(`- Coverage: ${statParts.join(", ")}`);
  lines.push(`- Codecov page: ${data.url}`);
  lines.push("");

  const files = (data.files || []).slice();
  // Sort by missed lines descending (files with no numeric value go last).
  files.sort((a, b) => {
    const am = parseInt(a.missedLines, 10);
    const bm = parseInt(b.missedLines, 10);
    const av = Number.isNaN(am) ? -1 : am;
    const bv = Number.isNaN(bm) ? -1 : bm;
    return bv - av;
  });

  const filesWithMisses = files.filter((f) => {
    const m = parseInt(f.missedLines, 10);
    return !Number.isNaN(m) && m > 0;
  });

  lines.push("## Files with missing coverage (highest impact first)");
  if (!filesWithMisses.length) {
    lines.push(
      "- Codecov did not report any files with missed lines on this page (or the file list wasn't visible when this prompt was generated). Re-check the 'Files changed' tab."
    );
  } else {
    filesWithMisses.forEach((f, idx) => {
      const bits = [];
      if (f.missedLines) bits.push(`${f.missedLines} missed line${f.missedLines === "1" ? "" : "s"}`);
      if (f.patchPct) bits.push(`patch coverage ${f.patchPct}`);
      if (f.headPct) bits.push(`head coverage ${f.headPct}`);
      if (f.changePct) bits.push(`change ${f.changePct}`);
      lines.push(`${idx + 1}. \`${f.name}\` — ${bits.join(", ")}`);
      if (f.uncoveredLines && f.uncoveredLines.length) {
        lines.push(
          `   Known uncovered/partial line numbers (from the currently expanded diff panel): ${f.uncoveredLines.join(
            ", "
          )}`
        );
      }
    });
  }
  lines.push("");

  const filesNoData = files.filter((f) => !filesWithMisses.includes(f));
  if (filesNoData.length) {
    lines.push("## Other changed files (no missed lines reported)");
    filesNoData.forEach((f) => {
      lines.push(
        `- \`${f.name}\`${f.patchPct ? ` — patch coverage ${f.patchPct}` : ""}`
      );
    });
    lines.push("");
  }

  lines.push("## Task");
  lines.push(
    "1. For each file listed above under \"Files with missing coverage\", open the file and the corresponding diff on the Codecov/GitHub page and identify the exact lines that are uncovered or only partially covered."
  );
  lines.push(
    "2. Write or extend unit/integration tests so that those lines are exercised, following the existing test framework, style, and file layout used elsewhere in this repository."
  );
  lines.push(
    "3. Prioritize files with the most missed lines and the lowest patch coverage percentage first."
  );
  lines.push(
    "4. Do not change production behavior to make coverage easier — only add or improve tests, unless a line is genuinely untestable/dead code, in which case explain why and consider removing it or adding a coverage-ignore comment per the project's conventions."
  );
  lines.push(
    "5. After adding tests, run the project's test suite (with coverage enabled) locally and confirm the previously uncovered lines are now covered and no existing tests were broken."
  );
  lines.push(
    "6. Keep changes scoped to tests (and, if unavoidable, minimal test-support code) — do not refactor unrelated code."
  );
  lines.push("");
  lines.push(
    "If some uncovered line numbers weren't captured above (Codecov's diff view is virtualized so only expanded/visible lines are listed), open the file's diff panel on the Codecov page to see the exact red-highlighted lines, or check the coverage report locally."
  );

  if (data.warnings && data.warnings.length) {
    lines.push("");
    lines.push("## Notes from the scraper");
    data.warnings.forEach((w) => lines.push(`- ${w}`));
  }

  return lines.join("\n");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  return tab;
}

function isCodecovUrl(url) {
  try {
    const u = new URL(url);
    return /(^|\.)codecov\.io$/.test(u.hostname);
  } catch (e) {
    return false;
  }
}

async function scrapeActiveTab(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["scraper.js"]
  });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.scrapeCodecovPage()
  });
  return result;
}

generateBtn.addEventListener("click", async () => {
  setStatus("");
  outputEl.style.display = "none";
  copyBtn.style.display = "none";
  generateBtn.disabled = true;
  generateBtn.textContent = "Reading Codecov page…";

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      throw new Error("Couldn't find the active tab.");
    }
    if (!isCodecovUrl(tab.url || "")) {
      throw new Error(
        "This doesn't look like a codecov.io page. Open a Codecov pull request or commit page first."
      );
    }

    const data = await scrapeActiveTab(tab.id);
    if (!data) {
      throw new Error("Couldn't read data from the page.");
    }

    const prompt = buildPrompt(data);
    outputEl.value = prompt;
    outputEl.style.display = "block";
    copyBtn.style.display = "block";

    if (data.warnings && data.warnings.length) {
      setStatus(data.warnings.join(" "), "error");
    } else {
      const count = (data.files || []).filter((f) => {
        const m = parseInt(f.missedLines, 10);
        return !Number.isNaN(m) && m > 0;
      }).length;
      setStatus(
        `Prompt generated from ${count} ${pluralize(
          count,
          "file"
        )} with missing coverage.`,
        "success"
      );
    }
  } catch (err) {
    setStatus(err && err.message ? err.message : String(err), "error");
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate prompt from this page";
  }
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(outputEl.value);
    setStatus("Copied to clipboard.", "success");
  } catch (err) {
    outputEl.select();
    document.execCommand("copy");
    setStatus("Copied to clipboard.", "success");
  }
});
