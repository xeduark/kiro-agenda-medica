"use strict";

const { Router } = require("express");
const defaultRepository = require("../repositories/appointmentsRepository");

// PostgreSQL exclusion-constraint violation code.
const PG_EXCLUSION_VIOLATION = "23P01";

/**
 * Factory that builds the appointments router with the given repository.
 * Accepts a custom repo so unit tests can inject a mock without touching the DB.
 *
 * @param {object} repo - must expose { create, listByDoctorAndDate }
 * @returns {import("express").Router}
 */
function makeAppointmentsRouter(repo) {
  const router = Router();

  /**
   * POST /appointments
   * Body: { doctorId, patientId, startsAt, endsAt, scheduleId? }
   */
  router.post("/appointments", async (req, res) => {
    const { doctorId, patientId, startsAt, endsAt, scheduleId } = req.body || {};

    // Validate required fields.
    if (!doctorId || !patientId || !startsAt || !endsAt) {
      return res.status(400).json({ error: "doctorId, patientId, startsAt and endsAt are required." });
    }

    // Validate time ordering.
    if (new Date(endsAt) <= new Date(startsAt)) {
      return res.status(400).json({ error: "endsAt must be after startsAt." });
    }

    try {
      const appointment = await repo.create({
        doctorId,
        patientId,
        scheduleId: scheduleId ?? null,
        startsAt,
        endsAt,
      });
      return res.status(201).json(appointment);
    } catch (err) {
      if (err.code === PG_EXCLUSION_VIOLATION) {
        // Log only the error code, never patient data.
        console.error("Appointment overlap rejected. pg code:", err.code);
        return res.status(409).json({ error: "El médico ya tiene una cita en ese horario." });
      }
      // Log error code/message only — no patient identifiers.
      console.error("Unexpected error creating appointment. pg code:", err.code || "N/A");
      return res.status(500).json({ error: "No se pudo agendar. Intenta de nuevo." });
    }
  });

  /**
   * GET /doctors/:id/appointments?date=YYYY-MM-DD
   * Returns the day agenda for a doctor (non-cancelled appointments only).
   */
  router.get("/doctors/:id/appointments", async (req, res, next) => {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Query parameter 'date' (YYYY-MM-DD) is required." });
    }

    try {
      const appointments = await repo.listByDoctorAndDate(req.params.id, date);
      return res.json(appointments);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = {
  makeAppointmentsRouter,
  appointmentsRepository: defaultRepository,
};
