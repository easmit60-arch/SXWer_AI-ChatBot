import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const serverOffline = fs.readFileSync(
  path.join(root, "server-offline.js"),
  "utf8",
);

test("offline permissions UI exposes explicit local access choices", () => {
  assert.match(indexHtml, /Allow local-only access/i);
  assert.match(indexHtml, /No, keep private/i);
  assert.match(indexHtml, /offline local permissions/i);
});

test("chat UI renders an initial assistant message in the messages container", () => {
  assert.match(
    indexHtml,
    /<div id="messages" class="messages">\s*<div class="message assistant">\s*<div class="message-content">/i,
  );
  assert.match(indexHtml, /Hello\. I'm here to listen without judgment\./i);
});

test("server exposes a local-permissions endpoint and gating", () => {
  assert.match(serverOffline, /\/api\/local-permissions/i);
  assert.match(serverOffline, /requiresLocalPermission/i);
});
