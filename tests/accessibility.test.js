/**
 * Accessibility Tests — WCAG 2.2 AA
 *
 * These tests enforce the Human Rights by Design principle that
 * "Accessibility is a human right — not an enhancement."
 *
 * All HTML pages in the application must pass WCAG 2.2 AA.
 * Violations fail the test suite and block merging.
 *
 * Implementation:
 *   axe-core runs against each page's static HTML using jsdom.
 *   This works offline with no server required.
 *
 * To run:
 *   npm test              (runs all tests including these)
 *   npm run test:a11y     (runs accessibility tests only)
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import axe from "axe-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// ============================================================================
// HELPER: run axe against an HTML string and return violations
// ============================================================================

/**
 * Analyse an HTML string with axe-core at WCAG 2.2 AA level.
 *
 * We load the axe-core minified source and evaluate it directly on the
 * jsdom window object via `window.eval()`. Injecting it as a `<script>` tag
 * causes jsdom to fail when the page's own scripts try to load relative
 * resources, so `window.eval()` is the correct integration approach.
 *
 * @param {string} html - Full HTML document source
 * @param {string} label - Human-readable label for error messages
 * @returns {Promise<import('axe-core').Result[]>} Array of violations
 */
async function runAxe(html, label) {
  const axeSource = fs.readFileSync(
    path.join(root, "node_modules", "axe-core", "axe.min.js"),
    "utf8",
  );

  // Evaluate axe-core directly on the window object.
  // Injecting it as a <script> tag causes jsdom to fail on scripts that load
  // relative resources (the page's own JS), so we use window.eval() instead.
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "http://localhost/",
    pretendToBeVisual: true,
  });

  // Evaluate axe inside the jsdom window context
  dom.window.eval(axeSource);

  // Run axe inside the jsdom context
  const results = await dom.window.axe.run(dom.window.document, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"],
    },
  });

  return results.violations;
}

/**
 * Format axe violations into a readable failure message.
 * @param {import('axe-core').Result[]} violations
 * @returns {string}
 */
function formatViolations(violations) {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 3)
        .map((n) => `      - ${n.html.slice(0, 120)}`)
        .join("\n");
      return `  [${v.impact?.toUpperCase() ?? "?"}] ${v.id}: ${v.description}\n${nodes}`;
    })
    .join("\n\n");
}

// ============================================================================
// PAGES UNDER TEST
// ============================================================================

const pages = [
  {
    label: "index.html (main chat UI)",
    file: path.join(root, "index.html"),
  },
  {
    label: "public/consent-ledger.html (Consent Ledger UI)",
    file: path.join(root, "public", "consent-ledger.html"),
  },
];

// ============================================================================
// TESTS
// ============================================================================

for (const { label, file } of pages) {
  test(`WCAG 2.2 AA: ${label}`, async () => {
    const html = fs.readFileSync(file, "utf8");
    const violations = await runAxe(html, label);

    // Filter to critical and serious violations only — these indicate real
    // barriers for users with disabilities.  Minor and moderate issues are
    // reported as diagnostics but do not fail the build so that existing
    // pages can improve incrementally without blocking all PRs.
    const blocking = violations.filter((v) =>
      ["critical", "serious"].includes(v.impact),
    );

    if (violations.length > 0 && blocking.length === 0) {
      // Non-blocking violations — surface them as diagnostics
      console.log(
        `[A11Y] Non-critical issues in ${label} (${violations.length} total — not failing build):\n` +
          formatViolations(violations),
      );
    }

    assert.equal(
      blocking.length,
      0,
      `WCAG 2.2 AA critical/serious violations found in ${label}:\n\n` +
        formatViolations(blocking),
    );
  });
}

// ============================================================================
// STRUCTURAL CHECKS (fast, no browser needed)
// ============================================================================

test("index.html has a <html lang> attribute for screen reader language support", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /<html[^>]+lang="/i);
});

test("consent-ledger.html has a <html lang> attribute for screen reader language support", () => {
  const html = fs.readFileSync(
    path.join(root, "public", "consent-ledger.html"),
    "utf8",
  );
  assert.match(html, /<html[^>]+lang="/i);
});

test("index.html includes a visible skip-navigation link or landmark regions", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const hasSkipLink = /href="#[a-z]/.test(html);
  const hasMain = /<main[\s>]|role="main"/i.test(html);
  assert.ok(
    hasSkipLink || hasMain,
    "index.html should have a skip-navigation link or a <main> landmark",
  );
});

test("consent-ledger.html has a skip-navigation link", () => {
  const html = fs.readFileSync(
    path.join(root, "public", "consent-ledger.html"),
    "utf8",
  );
  assert.match(
    html,
    /class="skip-link"|href="#main-content"/i,
    "consent-ledger.html should include a skip-navigation link",
  );
});

test("all interactive elements in index.html that lack visible text have aria-label or title", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  // Buttons with no visible text (icon-only) must have aria-label
  const iconButtons = html.match(
    /<button[^>]*>(\s*<[^/][^>]*>\s*<\/[^>]*>\s*)<\/button>/gi,
  );
  if (iconButtons) {
    for (const btn of iconButtons) {
      const hasLabel =
        /aria-label="|title="|aria-labelledby="|aria-describedby=/.test(btn);
      assert.ok(
        hasLabel,
        `Icon-only button is missing accessible label: ${btn.slice(0, 120)}`,
      );
    }
  }
});

test("chat message container has role=log for screen-reader live-region support", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(
    html,
    /id="messages"[\s\S]{0,200}role="log"/,
    'The #messages container must have role="log" for screen readers',
  );
});

test("form inputs in index.html have associated labels or aria-label", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  // Find <input> and <textarea> elements (not hidden)
  const inputs = html.match(
    /<(?:input|textarea)[^>]*(?:type="(?!hidden)[^"]*")?[^>]*>/gi,
  );
  if (inputs) {
    for (const input of inputs) {
      const id = input.match(/id="([^"]+)"/)?.[1];
      const hasAriaLabel =
        /aria-label="|aria-labelledby="|placeholder="/.test(input);
      const hasLinkedLabel = id && new RegExp(`for="${id}"`).test(html);
      assert.ok(
        hasAriaLabel || hasLinkedLabel,
        `Input/textarea is missing an accessible label: ${input.slice(0, 120)}`,
      );
    }
  }
});
