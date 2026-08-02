import express from "express";

export function createLedgerRoutes({
  csrfProtection,
  requireAuth,
  requireBlockchainFeatureConsent,
  ledgerController,
}) {
  const router = express.Router();

  router.get("/ledger/status", ledgerController.getStatus);
  router.get("/ledger/history", ledgerController.getHistory);
  router.get("/ledger/disclosure", ledgerController.getDisclosure);
  router.get("/ledger/export", ledgerController.exportLedger);
  router.get("/ledger/verify", ledgerController.verifyLedger);

  router.post(
    "/ledger/consent",
    csrfProtection,
    requireAuth,
    requireBlockchainFeatureConsent,
    ledgerController.recordConsent,
  );

  router.post(
    "/ledger/revoke",
    csrfProtection,
    requireAuth,
    requireBlockchainFeatureConsent,
    ledgerController.revokeConsent,
  );

  router.post(
    "/ledger/record-export",
    csrfProtection,
    requireAuth,
    requireBlockchainFeatureConsent,
    ledgerController.recordExport,
  );

  router.post(
    "/ledger/record-deletion",
    csrfProtection,
    requireAuth,
    requireBlockchainFeatureConsent,
    ledgerController.recordDeletion,
  );

  router.post(
    "/ledger/policy-acceptance",
    csrfProtection,
    requireAuth,
    requireBlockchainFeatureConsent,
    ledgerController.recordPolicyAcceptance,
  );

  router.post(
    "/ledger/wallet/disconnect",
    csrfProtection,
    requireAuth,
    requireBlockchainFeatureConsent,
    ledgerController.disconnectWallet,
  );

  router.post(
    "/ledger/blockchain/disable",
    csrfProtection,
    requireAuth,
    requireBlockchainFeatureConsent,
    ledgerController.disableBlockchain,
  );

  return router;
}
