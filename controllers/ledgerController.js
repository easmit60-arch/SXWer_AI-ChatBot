function assertFunction(fn, name) {
  if (typeof fn !== "function") {
    throw new TypeError(`${name} must be a function`);
  }
}

export function createLedgerController(handlers = {}) {
  const required = [
    "getStatus",
    "getHistory",
    "getDisclosure",
    "exportLedger",
    "verifyLedger",
    "recordConsent",
    "revokeConsent",
    "recordExport",
    "recordDeletion",
    "recordPolicyAcceptance",
    "disconnectWallet",
    "disableBlockchain",
  ];

  for (const key of required) {
    assertFunction(handlers[key], `handlers.${key}`);
  }

  return Object.freeze({
    getStatus: handlers.getStatus,
    getHistory: handlers.getHistory,
    getDisclosure: handlers.getDisclosure,
    exportLedger: handlers.exportLedger,
    verifyLedger: handlers.verifyLedger,
    recordConsent: handlers.recordConsent,
    revokeConsent: handlers.revokeConsent,
    recordExport: handlers.recordExport,
    recordDeletion: handlers.recordDeletion,
    recordPolicyAcceptance: handlers.recordPolicyAcceptance,
    disconnectWallet: handlers.disconnectWallet,
    disableBlockchain: handlers.disableBlockchain,
  });
}
