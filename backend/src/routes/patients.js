"use strict";

const { Router } = require("express");
const { pool } = require("../db/pool");

const router = Router();

// GET /patients — returns all patients ordered alphabetically.
// IMPORTANT: patient PII (full_name, document_id, phone, email) must NEVER be logged.
router.get("/patients", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, full_name, document_id, phone, email, created_at, updated_at FROM patients ORDER BY full_name"
    );
    res.json(rows);
  } catch (err) {
    // Do NOT log patient data — pass error to generic handler without extra context.
    next(err);
  }
});

module.exports = router;
