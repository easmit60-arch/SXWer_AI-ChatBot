import express from "express";

export function createChatRoutes({
  validateChatInput,
  csrfProtection,
  requireAuth,
  chatController,
}) {
  const router = express.Router();

  router.post(
    "/chat",
    validateChatInput,
    csrfProtection,
    requireAuth,
    chatController.handleChat,
  );

  return router;
}
