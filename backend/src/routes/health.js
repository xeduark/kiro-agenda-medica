"use strict";

const { Router } = require("express");

const router = Router();

// GET /health — liveness check used by load balancers and monitoring.
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

module.exports = router;
