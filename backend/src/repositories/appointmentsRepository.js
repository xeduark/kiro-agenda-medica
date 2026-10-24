"use strict";

const { pool } = require("../db/pool");

/**
 * Inserts a new appointment row.
 * Throws the raw pg error so the caller can inspect error.code (e.g. 23P01).
 *
 * @param {{ doctorId: number|string, patientId: number|string, scheduleId?: number|string|null, startsAt: string, endsAt: string }} params
 * @returns {Promise<object>} The inserted appointment row.
 */
async function create({ doctorId, patientId, scheduleId, startsAt, endsAt }) {
  const { rows } = await pool.query(
    `INSERT INTO appointments (doctor_id, patient_id, schedule_id, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, doctor_id, patient_id, schedule_id, starts_at, ends_at, status, reminder_sent, created_at, updated_at`,
    [doctorId, patientId, scheduleId ?? null, startsAt, endsAt]
  );
  return rows[0];
}

/**
 * Lists confirmed/completed appointments for a doctor on a given UTC date.
 *
 * @param {number|string} doctorId
 * @param {string} date  - ISO date string "YYYY-MM-DD"
 * @returns {Promise<object[]>} Appointments ordered by starts_at.
 */
async function listByDoctorAndDate(doctorId, date) {
  const { rows } = await pool.query(
    `SELECT id, doctor_id, patient_id, schedule_id, starts_at, ends_at,
            status, reminder_sent, created_at, updated_at
     FROM appointments
     WHERE doctor_id = $1
       AND (starts_at AT TIME ZONE 'UTC')::date = $2::date
       AND status <> 'cancelled'
     ORDER BY starts_at`,
    [doctorId, date]
  );
  return rows;
}

/**
 * Changes an appointment status (soft delete via 'cancelled', never DELETE).
 * Only confirmed appointments can be closed.
 *
 * @returns {Promise<object|undefined>} The updated row, or undefined if not found / not confirmed.
 */
async function updateStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE appointments SET status = $1, updated_at = now()
     WHERE id = $2 AND status = 'confirmed'
     RETURNING id, doctor_id, patient_id, starts_at, ends_at, status`,
    [status, id]
  );
  return rows[0];
}

module.exports = { create, listByDoctorAndDate, updateStatus };
