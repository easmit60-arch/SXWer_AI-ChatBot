import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const serverOffline = fs.readFileSync(path.join(root, "server-offline.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const dashboardScript = fs.readFileSync(path.join(root, "public", "human-rights-dashboard.js"), "utf8");

const expectedPages = [
  "privacy-dashboard",
  "consent-dashboard",
  "data-manager",
  "export-center",
  "delete-my-data",
  "transparency-center",
  "accessibility-center",
  "ai-disclosure",
  "human-rights-report",
  "security-status",
  "explain-this-response",
];

test("server exposes human-rights APIs and CSP-enabled security headers", () => {
  assert.match(serverOffline, /contentSecurityPolicy:\s*CONTENT_SECURITY_POLICY/i);
  assert.match(serverOffline, /app\.get\("\/api\/human-rights\/report"/i);
  assert.match(serverOffline, /app\.post\("\/api\/data-export"/i);
  assert.match(serverOffline, /app\.post\("\/api\/data-delete"/i);
  assert.match(serverOffline, /versionedConsent:\s*getConsentDashboard\(sessionId\)/i);
  assert.match(serverOffline, /buildTransparentChatPayload/i);
});

test("chat UI links to the new human-rights dashboards", () => {
  assert.match(indexHtml, /href="\/human-rights-report"/i);
  assert.match(indexHtml, /href="\/privacy-dashboard"/i);
  assert.match(indexHtml, /href="\/consent-dashboard"/i);
  assert.match(indexHtml, /href="\/data-manager"/i);
  assert.match(indexHtml, /href="\/explain-this-response"/i);
});

test("all requested human-rights pages exist and share the dashboard runtime", () => {
  for (const page of expectedPages) {
    const html = fs.readFileSync(path.join(root, "public", `${page}.html`), "utf8");
    assert.match(html, /human-rights-dashboard\.js/i, `${page} should load the shared dashboard runtime`);
    assert.match(html, /id="dashboard-root"/i, `${page} should render the shared dashboard root`);
  }
  assert.match(dashboardScript, /Export my data/i);
  assert.match(dashboardScript, /Why did I receive this answer\?/i);
  assert.match(dashboardScript, /Delete my data/i);
});
