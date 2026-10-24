"use strict";

const { Router } = require("express");
const { pool } = require("../db/pool");

const router = Router();

// GET /doctors — returns all doctors ordered alphabetically.
router.get("/doctors", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, full_name, specialty, created_at, updated_at FROM doctors ORDER BY full_name"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
