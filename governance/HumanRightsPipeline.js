function normalizeBoolean(value, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

export function runHumanRightsPipeline({
  understand = true,
  consent = true,
  refuse = true,
  inspect = true,
  exportData = true,
  deleteData = true,
  verify = true,
  continueOffline = true,
  feature = "unknown",
} = {}) {
  const rights = Object.freeze({
    understand: normalizeBoolean(understand),
    consent: normalizeBoolean(consent),
    refuse: normalizeBoolean(refuse),
    inspect: normalizeBoolean(inspect),
    export: normalizeBoolean(exportData),
    delete: normalizeBoolean(deleteData),
    verify: normalizeBoolean(verify),
    continueOffline: normalizeBoolean(continueOffline),
  });

  const failedChecks = Object.entries(rights)
    .filter(([, allowed]) => !allowed)
    .map(([name]) => name);

  return Object.freeze({
    feature,
    rights,
    failedChecks: Object.freeze(failedChecks),
    allowed: failedChecks.length === 0,
  });
}
