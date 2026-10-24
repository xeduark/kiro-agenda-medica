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

// POST /patients — creates a patient. Body: { full_name, document_id, phone, email }
router.post("/patients", async (req, res, next) => {
  const body = req.body || {};
  const clean = Object.fromEntries(["full_name", "document_id", "phone", "email"].map((k) => [k, typeof body[k] === "string" ? body[k].trim() : ""]));
  if (!clean.full_name || !clean.document_id) {
    return res.status(400).json({ error: "Faltan campos obligatorios: full_name, document_id." });
  }
  try {
    const { rows } = await pool.query(
      "INSERT INTO patients (full_name, document_id, phone, email) VALUES ($1, $2, $3, $4) RETURNING id, full_name",
      ["full_name", "document_id", "phone", "email"].map((k) => clean[k] || null)
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Ya existe un paciente con ese documento." });
    next(err);
  }
});

// PUT /patients/:id — updates a patient. Body: { full_name, document_id, phone, email }
router.put("/patients/:id", async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Id de paciente inválido." });
  const body = req.body || {};
  const clean = Object.fromEntries(["full_name", "document_id", "phone", "email"].map((k) => [k, typeof body[k] === "string" ? body[k].trim() : ""]));
  if (!clean.full_name || !clean.document_id) {
    return res.status(400).json({ error: "Faltan campos obligatorios: full_name, document_id." });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE patients SET full_name = $1, document_id = $2, phone = $3, email = $4, updated_at = now()
       WHERE id = $5 RETURNING id, full_name`,
      [clean.full_name, clean.document_id, clean.phone || null, clean.email || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Paciente no encontrado." });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Ya existe un paciente con ese documento." });
    next(err);
  }
});

module.exports = router;
