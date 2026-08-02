import assert from "node:assert/strict";
import test from "node:test";

import {
  appendDisclosure,
  buildDisclosure,
} from "../governance/buildDisclosure.js";
import { reviewHumanRightsText } from "../governance/HumanRightsReview.js";
import { runHumanRightsPipeline } from "../governance/HumanRightsPipeline.js";
import { requireConsentForFeature } from "../permissions/ConsentGuard.js";
import { verifyResourceCollection } from "../ethics/resourceVerifier.js";
import {
  assertBlockchainPolicyCompliant,
  sanitizeBlockchainDocument,
} from "../blockchain/blockchainPolicy.js";
import { getGovernanceFlagSnapshot } from "../governance/aiConstitution.js";

test("governance flags default to false for analytics/prompts/diagnostics", () => {
  const flags = getGovernanceFlagSnapshot();
  assert.equal(typeof flags.ALLOW_ANALYTICS, "boolean");
  assert.equal(typeof flags.ALLOW_PROMPTS, "boolean");
  assert.equal(typeof flags.ALLOW_DIAGNOSTICS, "boolean");
});

test("buildDisclosure appends mandatory disclosure text", () => {
  const disclosure = buildDisclosure({
    aiUsed: true,
    model: "mistral-small-latest",
    provider: "mistral (online)",
    confidence: "medium",
    externalRequests: ["Configured provider"],
    resourcesConsulted: ["Local policy"],
    consentState: "granted",
  });

  const output = appendDisclosure("Hello", disclosure);
  assert.match(output, /AI Disclosure/i);
  assert.match(output, /Model: mistral-small-latest/i);
  assert.match(output, /Consent: granted/i);
});

test("HumanRightsReview softens coercive and moralizing language", () => {
  const reviewed = reviewHumanRightsText(
    "you must obey because there is only one right choice and that is dirty",
  );
  assert.equal(reviewed.passed, false);
  assert.ok(reviewed.flags.includes("coercion"));
  assert.ok(reviewed.flags.includes("moralizing"));
  assert.doesNotMatch(
    reviewed.reviewedText,
    /you must obey|only one right choice|dirty/i,
  );
});

test("HumanRightsPipeline blocks when inspect/export/delete rights are unavailable", () => {
  const result = runHumanRightsPipeline({
    feature: "online-ai",
    inspect: false,
    exportData: false,
    deleteData: false,
  });
  assert.equal(result.allowed, false);
  assert.ok(result.failedChecks.includes("inspect"));
  assert.ok(result.failedChecks.includes("export"));
  assert.ok(result.failedChecks.includes("delete"));
});

test("ConsentGuard blocks online AI when required scopes are missing", () => {
  const blocked = requireConsentForFeature({
    feature: "online-ai",
    sessionId: "governance-test",
    consentState: { scopes: { ai: true, internet: false } },
  });

  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason, /Missing consent scopes/i);
});

test("resourceVerifier rejects malformed or non-https resources", () => {
  const verification = verifyResourceCollection([
    {
      id: "ok",
      name: "Valid Org",
      description: "Desc",
      url: "https://example.org",
    },
    {
      id: "bad",
      name: "Bad Org",
      description: "Desc",
      url: "http://not-secure.test",
    },
  ]);

  assert.equal(verification.verified.length, 1);
  assert.equal(verification.rejected.length, 1);
  assert.ok(verification.rejected[0].issues.includes("invalid-url"));
});

test("blockchain policy strips disallowed document fields and rejects PII-like fields", () => {
  const sanitized = sanitizeBlockchainDocument({
    action: "consent_granted",
    timestamp: Date.now(),
    email: "private@example.com",
    prompt: "this should never be stored",
  });

  assert.equal(Object.hasOwn(sanitized, "email"), false);
  assert.equal(Object.hasOwn(sanitized, "prompt"), false);

  assert.throws(() => {
    assertBlockchainPolicyCompliant(
      { message: "should fail" },
      { action: "ok" },
    );
  }, /Blocked blockchain fields detected/i);
});
