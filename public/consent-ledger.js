/**
 * SXWer AI ChatBot — Consent Ledger Client Script
 *
 * HUMAN RIGHTS DESIGN:
 * - Every blockchain action is preceded by a plain-language explanation.
 * - No action is taken silently.
 * - Every button clearly states what it does and whether it is reversible.
 * - Blockchain is never activated without explicit user consent shown in full.
 *
 * ACCESSIBILITY:
 * - WCAG 2.2 AA: focus management after dynamic content changes
 * - aria-live regions announce status changes to screen readers
 * - Keyboard-only users can trigger all actions
 * - Error and success messages have clear colour + text coding
 *
 * ARCHITECTURE:
 * - Communicates with /api/ledger/* endpoints on the local server
 * - Falls back gracefully if blockchain is disabled or server is unreachable
 * - No external CDN dependencies
 */

'use strict';

// ============================================================================
// API HELPERS
// ============================================================================

/**
 * Fetch a ledger API endpoint and return parsed JSON.
 *
 * @param {string} path    - e.g. '/api/ledger/status'
 * @param {string} [method='GET']
 * @param {Object} [body]  - Request body for POST requests
 * @returns {Promise<Object>}
 */
async function apiCall(path, method = 'GET', body = undefined) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'same-origin',
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(path, options);
  if (!res.ok) {
    let msg = `Server returned ${res.status}`;
    try { const d = await res.json(); msg = d.error || d.message || msg; } catch { /* noop */ }
    throw new Error(msg);
  }
  return res.json();
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Set the text of an element by ID and optionally apply a CSS class.
 *
 * @param {string} id
 * @param {string} text
 * @param {string} [cssClass]
 */
function setText(id, text, cssClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  if (cssClass) {
    el.className = '';
    el.classList.add(cssClass);
  }
}

/**
 * Show or hide an element by ID.
 *
 * @param {string} id
 * @param {boolean} visible
 */
function setVisible(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = !visible;
}

/**
 * Display an action result message.
 *
 * @param {string} message
 * @param {'ok'|'error'|''} [type='']
 */
function showResult(message, type = '') {
  const el = document.getElementById('action-result');
  if (!el) return;
  el.textContent = message;
  el.className = `action-result${type ? ` result-${type}` : ''}`;
  // Move focus to result so screen readers announce it
  if (message) {
    el.setAttribute('tabindex', '-1');
    el.focus();
  }
}

/**
 * Format a Unix millisecond timestamp for display.
 *
 * @param {number|null} ts
 * @returns {string}
 */
function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ts));
  } catch {
    return String(ts);
  }
}

// ============================================================================
// STATUS REFRESH
// ============================================================================

/**
 * Load and display the current consent ledger status.
 */
async function refreshStatus() {
  try {
    const data = await apiCall('/api/ledger/status');

    setText('status-consent',
      data.hasActiveConsent ? 'Yes' : 'No',
      data.hasActiveConsent ? 'status-yes' : 'status-no');

    setText('status-blockchain',
      data.blockchainEnabled ? 'Enabled' : 'Disabled',
      data.blockchainEnabled ? 'status-yes' : 'status-muted');

    setText('status-wallet',
      data.walletConnected ? 'Connected' : 'Not connected',
      data.walletConnected ? 'status-yes' : 'status-muted');

    setText('status-policy', data.policyVersion || '—');
    setText('status-granted-at', formatTimestamp(data.consentGrantedAt));
    setText('status-revoked-at', formatTimestamp(data.consentRevokedAt));
    setText('status-export-count', String(data.exportCount ?? '—'));
    setText('status-deletion-count', String(data.deletionCount ?? '—'));
    setText('status-total-records', String(data.totalLedgerRecords ?? '—'));
    setText('status-verify', data.verificationStatus || '—',
      data.verificationStatus === 'verified' ? 'status-yes' : 'status-muted');

  } catch (err) {
    console.warn('[LEDGER UI] Status refresh failed:', err.message);
    setText('status-blockchain', 'Unavailable', 'status-warn');
  }
}

// ============================================================================
// LEDGER TABLE
// ============================================================================

/**
 * Render the consent history table.
 */
async function refreshLedgerTable() {
  const tbody = document.getElementById('ledger-tbody');
  if (!tbody) return;

  try {
    const data = await apiCall('/api/ledger/history');
    const receipts = Array.isArray(data.receipts) ? data.receipts : [];

    if (receipts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No consent records yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = receipts.map((r) => `
      <tr>
        <td>${escapeHtml(r.eventType || '—')}</td>
        <td>${escapeHtml(formatTimestamp(r.timestamp))}</td>
        <td>
          <button type="button" class="tx-link" data-receipt='${escapeAttr(JSON.stringify(r))}'>
            ${escapeHtml((r.receiptId || '—').slice(0, 12))}…
          </button>
        </td>
        <td>${r.onChain ? '✓' : '—'}</td>
        <td>${r.verified !== false ? '✓' : '✗'}</td>
      </tr>
    `).join('');

    // Wire up receipt detail buttons
    tbody.querySelectorAll('.tx-link').forEach((btn) => {
      btn.addEventListener('click', () => {
        const receipt = JSON.parse(btn.dataset.receipt || '{}');
        showReceiptDetail(receipt);
      });
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      });
    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Could not load history: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/**
 * Show a receipt's full JSON in the detail panel.
 *
 * @param {Object} receipt
 */
function showReceiptDetail(receipt) {
  const panel = document.getElementById('receipt-detail');
  const body  = document.getElementById('receipt-detail-body');
  if (!panel || !body) return;

  body.textContent = JSON.stringify(receipt, null, 2);
  panel.hidden = false;
  // Move focus to the close button
  const closeBtn = document.getElementById('btn-close-detail');
  if (closeBtn) closeBtn.focus();
}

// ============================================================================
// DISCLOSURE FLOW
// ============================================================================

/**
 * Fetch and display the blockchain informed-consent disclosure.
 * The user must explicitly accept before any blockchain action proceeds.
 *
 * @returns {Promise<boolean>} true if user accepted, false if declined
 */
function showDisclosure() {
  return new Promise(async (resolve) => {
    try {
      const data = await apiCall('/api/ledger/disclosure');

      const body = document.getElementById('disclosure-body');
      if (body) body.textContent = data.body || '';

      setVisible('disclosure-section', true);

      const acceptBtn  = document.getElementById('btn-disclosure-accept');
      const declineBtn = document.getElementById('btn-disclosure-decline');
      if (acceptBtn) acceptBtn.focus();

      function cleanup() {
        setVisible('disclosure-section', false);
        acceptBtn?.removeEventListener('click', onAccept);
        declineBtn?.removeEventListener('click', onDecline);
      }

      function onAccept()  { cleanup(); resolve(true);  }
      function onDecline() { cleanup(); resolve(false); }

      acceptBtn?.addEventListener('click', onAccept,  { once: true });
      declineBtn?.addEventListener('click', onDecline, { once: true });

    } catch (err) {
      resolve(false);
    }
  });
}

// ============================================================================
// BUTTON HANDLERS
// ============================================================================

async function handleViewConsent() {
  try {
    const data = await apiCall('/api/ledger/history');
    showResult(`Loaded ${data.receipts?.length ?? 0} consent record(s). See table below.`, 'ok');
    await refreshLedgerTable();
  } catch (err) {
    showResult(`Could not load consent records: ${err.message}`, 'error');
  }
}

async function handleExportConsent() {
  try {
    const data = await apiCall('/api/ledger/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `consent-ledger-${Date.now()}.json`;
    a.setAttribute('aria-label', 'Download consent ledger JSON');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Record the export event
    await apiCall('/api/ledger/record-export', 'POST', { exportFormat: 'json' });

    showResult('Consent ledger exported successfully.', 'ok');
    await refreshStatus();
  } catch (err) {
    showResult(`Export failed: ${err.message}`, 'error');
  }
}

async function handleVerifyLedger() {
  try {
    const data = await apiCall('/api/ledger/verify');
    const msg  = data.allValid
      ? `All ${data.verified} record(s) verified successfully.`
      : `Verification complete: ${data.verified} valid, ${data.invalid} invalid.`;
    showResult(msg, data.allValid ? 'ok' : 'error');
    setText('status-verify',
      data.allValid ? 'verified' : 'invalid',
      data.allValid ? 'status-yes' : 'status-error');
  } catch (err) {
    showResult(`Verification failed: ${err.message}`, 'error');
  }
}

async function handleRevokeConsent() {
  const confirmed = window.confirm(
    'Revoking consent will write an immutable revocation record.\n\n' +
    'This does not delete your local data. You can re-enable consent at any time.\n\n' +
    'Continue?'
  );
  if (!confirmed) return;

  try {
    await apiCall('/api/ledger/revoke', 'POST');
    showResult('Consent revoked. A revocation receipt has been recorded.', 'ok');
    await Promise.all([refreshStatus(), refreshLedgerTable()]);
  } catch (err) {
    showResult(`Revoke failed: ${err.message}`, 'error');
  }
}

async function handleDisconnectWallet() {
  try {
    await apiCall('/api/ledger/wallet/disconnect', 'POST');
    showResult('Wallet disconnected. Key material cleared from memory.', 'ok');
    await refreshStatus();
  } catch (err) {
    showResult(`Disconnect failed: ${err.message}`, 'error');
  }
}

async function handleDisableBlockchain() {
  const confirmed = window.confirm(
    'Disabling blockchain will stop writing consent receipts to the chain.\n\n' +
    'Your local consent records will be preserved unless you also clear local data.\n' +
    'On-chain records (if any) are immutable and cannot be removed.\n\n' +
    'Continue?'
  );
  if (!confirmed) return;

  try {
    await apiCall('/api/ledger/blockchain/disable', 'POST');
    showResult('Blockchain disabled. The app continues working fully offline.', 'ok');
    await refreshStatus();
  } catch (err) {
    showResult(`Disable failed: ${err.message}`, 'error');
  }
}

// ============================================================================
// SECURITY HELPERS
// ============================================================================

/**
 * Escape a string for safe insertion as HTML text.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Escape a string for safe use in an HTML attribute.
 * @param {string} str
 * @returns {string}
 */
function escapeAttr(str) {
  return escapeHtml(str);
}

// ============================================================================
// INITIALISATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Button wiring
  document.getElementById('btn-view-consent')      ?.addEventListener('click', handleViewConsent);
  document.getElementById('btn-export-consent')    ?.addEventListener('click', handleExportConsent);
  document.getElementById('btn-verify-ledger')     ?.addEventListener('click', handleVerifyLedger);
  document.getElementById('btn-revoke-consent')    ?.addEventListener('click', handleRevokeConsent);
  document.getElementById('btn-disconnect-wallet') ?.addEventListener('click', handleDisconnectWallet);
  document.getElementById('btn-disable-blockchain')?.addEventListener('click', handleDisableBlockchain);
  document.getElementById('btn-close-detail')      ?.addEventListener('click', () => {
    setVisible('receipt-detail', false);
  });

  // Initial data load
  await Promise.all([refreshStatus(), refreshLedgerTable()]);
});
