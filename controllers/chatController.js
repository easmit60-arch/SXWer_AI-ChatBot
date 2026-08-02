function assertFunction(fn, name) {
  if (typeof fn !== "function") {
    throw new TypeError(`${name} must be a function`);
  }
}

export function shouldInvokeOnlineProvider({
  requestedMode = "offline",
  hasAIConsent = false,
  onlineApiActive = false,
} = {}) {
  return (
    String(requestedMode).toLowerCase() === "online" &&
    Boolean(hasAIConsent) &&
    Boolean(onlineApiActive)
  );
}

export function createChatController({ processChatRequest }) {
  assertFunction(processChatRequest, "processChatRequest");

  return Object.freeze({
    async handleChat(req, res) {
      return processChatRequest(req, res);
    },
  });
}
