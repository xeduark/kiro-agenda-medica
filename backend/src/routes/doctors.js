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

// POST /doctors — creates a doctor. Body: { full_name, specialty }
router.post("/doctors", async (req, res, next) => {
  const body = req.body || {};
  const clean = Object.fromEntries(["full_name", "specialty"].map((k) => [k, typeof body[k] === "string" ? body[k].trim() : ""]));
  if (!clean.full_name || !clean.specialty) {
    return res.status(400).json({ error: "Faltan campos obligatorios: full_name, specialty." });
  }
  try {
    const { rows } = await pool.query(
      "INSERT INTO doctors (full_name, specialty) VALUES ($1, $2) RETURNING id, full_name",
      ["full_name", "specialty"].map((k) => clean[k] || null)
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Ese médico ya existe." });
    next(err);
  }
});

module.exports = router;
