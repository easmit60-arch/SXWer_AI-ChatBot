import express from "express";

export function createDashboardRoutes({
  requireAuth,
  csrfProtection,
  dashboardController,
}) {
  const router = express.Router();

  router.get(
    "/human-rights/report",
    requireAuth,
    dashboardController.getHumanRightsReport,
  );
  router.post(
    "/data-export",
    csrfProtection,
    requireAuth,
    dashboardController.exportData,
  );
  router.post(
    "/data-delete",
    csrfProtection,
    requireAuth,
    dashboardController.deleteData,
  );

  return router;
}
