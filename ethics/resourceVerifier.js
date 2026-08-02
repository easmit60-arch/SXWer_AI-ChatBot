function isValidUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeText(value) {
  return String(value || "").trim();
}

export function verifyResource(resource = {}) {
  const id = normalizeText(resource.id || resource.name || "");
  const name = normalizeText(resource.name);
  const description = normalizeText(resource.description);
  const url = normalizeText(resource.url);

  const issues = [];
  if (!id) issues.push("missing-id");
  if (!name) issues.push("missing-name");
  if (!description) issues.push("missing-description");
  if (!isValidUrl(url)) issues.push("invalid-url");

  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues),
    resource: Object.freeze({ ...resource, id, name, description, url }),
  });
}

export function verifyResourceCollection(resources = []) {
  const verified = [];
  const rejected = [];

  for (const resource of Array.isArray(resources) ? resources : []) {
    const result = verifyResource(resource);
    if (result.valid) {
      verified.push(result.resource);
    } else {
      rejected.push(result);
    }
  }

  return Object.freeze({
    verified: Object.freeze(verified),
    rejected: Object.freeze(rejected),
  });
}
