const PAGE_CONFIG = {
  "privacy-dashboard": "Privacy Dashboard",
  "consent-dashboard": "Consent Dashboard",
  "data-dashboard": "Data Dashboard",
  "data-manager": "Data Manager",
  "export-center": "Export Center",
  "delete-my-data": "Delete My Data",
  "transparency-center": "Transparency Center",
  "accessibility-center": "Accessibility Center",
  "ai-disclosure": "AI Disclosure",
  "human-rights-report": "Human Rights Report",
  "security-status": "Security Status",
  "explain-this-response": "Explain This Response",
};

const pageKey = document.body.dataset.page || "human-rights-report";
const root = document.getElementById("dashboard-root");
const statusEl = document.getElementById("action-status");
let sessionContext = null;
let reportCache = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function ensureSession() {
  if (sessionContext) return sessionContext;
  const response = await fetch("/api/session", { credentials: "include" });
  if (!response.ok)
    throw new Error(`Session bootstrap failed: ${response.status}`);
  sessionContext = await response.json();
  return sessionContext;
}

async function apiFetch(url, options = {}) {
  const session = await ensureSession();
  const headers = new Headers(options.headers || {});
  headers.set("x-session-token", session.token);
  headers.set("x-session-id", session.sessionId);
  if (options.method && options.method !== "GET") {
    headers.set("x-csrf-token", session.csrfToken);
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { credentials: "include", ...options, headers });
}

function renderNav() {
  const nav = document.getElementById("dashboard-nav");
  nav.innerHTML = `<ul>${Object.entries(PAGE_CONFIG)
    .map(
      ([slug, title]) =>
        `<li><a href="/${slug}" ${slug === pageKey ? 'aria-current="page"' : ""}>${escapeHtml(title)}</a></li>`,
    )
    .join("")}</ul>`;
}

function renderCategory(category) {
  return `
    <article class="card" id="${escapeHtml(category.id)}">
      <h3>${escapeHtml(category.title)}</h3>
      <p><strong>What is collected:</strong> ${escapeHtml(category.collected.join(", "))}</p>
      <p><strong>Why:</strong> ${escapeHtml(category.why)}</p>
      <p><strong>Where stored:</strong> ${escapeHtml(category.whereStored)}</p>
      <p><strong>Retention:</strong> ${escapeHtml(category.retention)}</p>
      <p><strong>Encryption:</strong> ${escapeHtml(category.encryption)}</p>
      <p><strong>Who can access it:</strong> ${escapeHtml(category.access)}</p>
      <p><strong>Export:</strong> ${escapeHtml(category.export)}</p>
      <p><strong>Delete:</strong> ${escapeHtml(category.delete)}</p>
      <p><strong>Revoke collection:</strong> ${escapeHtml(category.revoke)}</p>
      <p><strong>Current state:</strong> ${escapeHtml(category.currentState)}</p>
    </article>`;
}

function renderReport(report) {
  const consentScopes = Object.entries(
    report.consentDashboard.current.scopes || {},
  )
    .map(
      ([scope, enabled]) =>
        `<tr><td>${escapeHtml(scope)}</td><td>${enabled ? "Enabled" : "Off"}</td></tr>`,
    )
    .join("");

  const auditRows =
    (report.auditTimeline || [])
      .map(
        (event) =>
          `<tr><td>${escapeHtml(event.timestamp)}</td><td>${escapeHtml(event.eventType)}</td><td>${escapeHtml(event.summary)}</td></tr>`,
      )
      .join("") || '<tr><td colspan="3">No audit events yet.</td></tr>';

  const rightsRows = Object.entries(
    report.latestTransparency?.rights || {
      understand: true,
      consent: true,
      refuse: true,
      revoke: true,
      inspect: true,
      export: true,
      delete: true,
      continueWithoutAI: true,
    },
  )
    .map(
      ([key, value]) =>
        `<tr><td>${escapeHtml(key)}</td><td>${value ? "Yes" : "No"}</td></tr>`,
    )
    .join("");

  const disclosure = report.latestTransparency?.disclosure;
  const explain = report.latestTransparency?.explain;

  root.innerHTML = `
    <section class="card">
      <h2>${escapeHtml(PAGE_CONFIG[pageKey] || "Human Rights Dashboard")}</h2>
      <p class="notice">This dashboard keeps the current session inspectable, exportable, deletable, and usable without mandatory online AI.</p>
    </section>

    <section class="card grid" aria-label="Primary controls">
      <div>
        <h3>Export Center</h3>
        <p>Download a portable package containing current-session consent, transparency, and audit records.</p>
        <button id="export-data" type="button">Export my data</button>
      </div>
      <div>
        <h3>Delete My Data</h3>
        <p>Clear current-session consent history, audit records, and explainability state.</p>
        <button id="delete-data" class="danger" type="button">Delete my data</button>
      </div>
      <div>
        <h3>Continue without AI</h3>
        <p>Offline-first support remains available even after refusing AI, internet, or blockchain scopes.</p>
        <button id="refresh-report" class="secondary" type="button">Refresh report</button>
      </div>
    </section>

    <section class="card">
      <h3>Consent Dashboard</h3>
      <p><strong>Status:</strong> ${escapeHtml(report.consentDashboard.current.status || "not-set")}</p>
      <p><strong>Policy version:</strong> ${escapeHtml(report.consentDashboard.current.policyVersion || "unknown")}</p>
      <p><strong>Schema version:</strong> ${escapeHtml(report.consentDashboard.current.schemaVersion || "unknown")}</p>
      <p><strong>Application version:</strong> ${escapeHtml(report.consentDashboard.current.applicationVersion || "unknown")}</p>
      <p><strong>Reason:</strong> ${escapeHtml(report.consentDashboard.current.reason || "No consent event recorded yet.")}</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Scope</th><th>State</th></tr></thead>
          <tbody>${consentScopes}</tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h3>Data Manager</h3>
      <div class="grid">${report.dataManager.categories.map(renderCategory).join("")}</div>
    </section>

    <section class="card">
      <h3>Data Storage Matrix</h3>
      <p>Each category includes inspect, export, and delete actions.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Current State</th>
              <th>Inspect</th>
              <th>Export</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            ${report.dataManager.categories
              .map(
                (category) => `
              <tr>
                <td>${escapeHtml(category.title)}</td>
                <td>${escapeHtml(category.currentState)}</td>
                <td><button type="button" class="secondary" data-action="inspect" data-category="${escapeHtml(category.id)}">Inspect</button></td>
                <td><button type="button" class="secondary" data-action="export" data-category="${escapeHtml(category.id)}">Export</button></td>
                <td><button type="button" class="danger" data-action="delete" data-category="${escapeHtml(category.id)}">Delete</button></td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h3>AI Disclosure</h3>
      <p><strong>AI used:</strong> ${disclosure?.aiUsed ? "Yes" : "No"}</p>
      <p><strong>Provider:</strong> ${escapeHtml(disclosure?.provider || "local-first")}</p>
      <p><strong>Model:</strong> ${escapeHtml(disclosure?.model || "n/a")}</p>
      <p><strong>Mode:</strong> ${escapeHtml(disclosure?.mode || "offline")}</p>
      <p><strong>Data sent:</strong> ${escapeHtml((disclosure?.sentData || ["No external transfer recorded"]).join(", "))}</p>
      <p><strong>Why:</strong> ${escapeHtml(disclosure?.why || "Provide a transparent response.")}</p>
      <p><strong>Confidence:</strong> ${escapeHtml(disclosure?.confidence || "medium")}</p>
      <p><strong>Limitations:</strong> ${escapeHtml((disclosure?.limitations || ["AI may be wrong or incomplete."]).join(" "))}</p>
    </section>

    <section class="card">
      <h3>Explain This Response</h3>
      <p><strong>Question:</strong> ${escapeHtml(explain?.question || "Why did I receive this answer?")}</p>
      <p><strong>Sources:</strong> ${escapeHtml((explain?.sources || ["No response recorded yet."]).join(", "))}</p>
      <p><strong>Rules used:</strong> ${escapeHtml((explain?.rulesUsed || []).join(", "))}</p>
      <p><strong>Reasoning summary:</strong> ${escapeHtml(explain?.reasoningSummary || "No response explainability record yet.")}</p>
    </section>

    <section class="card">
      <h3>Human Rights Report</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Question</th><th>Answer</th></tr></thead>
          <tbody>${rightsRows}</tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h3>Security Status</h3>
      <p><strong>Offline-first available:</strong> ${report.security.offlineFirst ? "Yes" : "No"}</p>
      <p><strong>Blockchain optional by default:</strong> ${report.security.blockchainOptional ? "Yes" : "No"}</p>
      <p><strong>Content Security Policy:</strong> ${escapeHtml(report.security.contentSecurityPolicy)}</p>
      <p><strong>Rate limiting:</strong> ${escapeHtml(report.security.rateLimit)}</p>
      <p><strong>Audit logging:</strong> ${escapeHtml(report.security.auditLogging)}</p>
    </section>

    <section class="card">
      <h3>Accessibility Center</h3>
      <ul>
        ${(report.accessibility || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>

    <section class="card">
      <h3>Audit Timeline</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Timestamp</th><th>Event</th><th>Summary</th></tr></thead>
          <tbody>${auditRows}</tbody>
        </table>
      </div>
    </section>`;

  document.getElementById("export-data")?.addEventListener("click", exportData);
  document.getElementById("delete-data")?.addEventListener("click", deleteData);
  document
    .getElementById("refresh-report")
    ?.addEventListener("click", loadReport);

  root.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.getAttribute("data-action");
      const categoryId = button.getAttribute("data-category");
      if (!action || !categoryId) return;

      if (action === "inspect") {
        const target = document.getElementById(categoryId);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          statusEl.textContent = `Inspecting ${categoryId}.`;
        }
        return;
      }

      if (action === "export") {
        await exportData();
        statusEl.textContent = `Export triggered for ${categoryId}.`;
        return;
      }

      if (action === "delete") {
        await deleteData();
        statusEl.textContent = `Delete workflow executed from ${categoryId}.`;
      }
    });
  });
}

async function loadReport() {
  statusEl.textContent = "Loading current-session human rights report…";
  const session = await ensureSession();
  const response = await apiFetch(
    `/api/human-rights/report?sessionId=${encodeURIComponent(session.sessionId)}`,
  );
  if (!response.ok)
    throw new Error(`Report request failed: ${response.status}`);
  reportCache = await response.json();
  renderReport(reportCache);
  statusEl.textContent = "Report ready.";
}

async function exportData() {
  statusEl.textContent = "Preparing export…";
  const response = await apiFetch("/api/data-export", {
    method: "POST",
    body: JSON.stringify({ page: pageKey }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || `Export failed: ${response.status}`);
  const blob = new Blob([JSON.stringify(data.exportPackage, null, 2)], {
    type: "application/json",
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `sxwer-export-${pageKey}.json`;
  link.click();
  URL.revokeObjectURL(href);
  statusEl.textContent = "Export downloaded.";
}

async function deleteData() {
  statusEl.textContent = "Deleting current-session data…";
  const response = await apiFetch("/api/data-delete", {
    method: "POST",
    body: JSON.stringify({ reason: "User requested deletion from dashboard." }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || `Delete failed: ${response.status}`);
  statusEl.textContent = data.message || "Current-session data deleted.";
  reportCache = null;
  await loadReport();
}

renderNav();
loadReport().catch((error) => {
  statusEl.textContent = error.message;
  root.innerHTML = `<section class="card"><h2>Unable to load dashboard</h2><p>${escapeHtml(error.message)}</p></section>`;
});
