const MAX_AUDIT_EVENTS_PER_SESSION = 200;
const auditTimelineStore = new Map();

function normalizeSessionId(sessionId = "default") {
  const normalized = String(sessionId || "default").trim();
  return normalized || "default";
}

function sanitizeDetails(details = {}) {
  if (!details || typeof details !== "object") {
    return Object.freeze({});
  }

  return Object.freeze(
    Object.fromEntries(
      Object.entries(details)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value]),
    ),
  );
}

function recordAuditEvent(sessionId = "default", eventType = "system.event", summary = "", details = {}) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const existingEvents = auditTimelineStore.get(normalizedSessionId) || [];
  const event = Object.freeze({
    id: `${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    eventType,
    summary: String(summary || "").trim() || eventType,
    details: sanitizeDetails(details),
  });

  existingEvents.push(event);
  if (existingEvents.length > MAX_AUDIT_EVENTS_PER_SESSION) {
    existingEvents.splice(0, existingEvents.length - MAX_AUDIT_EVENTS_PER_SESSION);
  }

  auditTimelineStore.set(normalizedSessionId, existingEvents);
  return event;
}

function getAuditTimeline(sessionId = "default") {
  return Object.freeze([...(auditTimelineStore.get(normalizeSessionId(sessionId)) || [])]);
}

function getAuditSummary(sessionId = "default") {
  const events = getAuditTimeline(sessionId);
  return Object.freeze({
    totalEvents: events.length,
    latestEvent: events.at(-1) || null,
    categories: Object.freeze(
      events.reduce((accumulator, event) => {
        accumulator[event.eventType] = (accumulator[event.eventType] || 0) + 1;
        return accumulator;
      }, {}),
    ),
  });
}

function clearAuditTimeline(sessionId = "default") {
  return auditTimelineStore.delete(normalizeSessionId(sessionId));
}

export {
  clearAuditTimeline,
  getAuditSummary,
  getAuditTimeline,
  recordAuditEvent,
};
