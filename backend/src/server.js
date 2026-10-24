"use strict";

// Load environment variables before anything else.
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const healthRouter = require("./routes/health");
const doctorsRouter = require("./routes/doctors");
const patientsRouter = require("./routes/patients");
const { makeAppointmentsRouter, appointmentsRepository } = require("./routes/appointments");

const app = express();

// --- Middleware ---
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || "http://localhost:5173,https://agenda-front-shm3.onrender.com")
      .split(",")
      .map((o) => o.trim()),
  })
);
app.use(express.json());

// --- Routes ---
app.use("/", healthRouter);
app.use("/", doctorsRouter);
app.use("/", patientsRouter);
app.use("/", makeAppointmentsRouter(appointmentsRepository));

// --- Generic error handler ---
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Log only the error message and stack — never patient PII.
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error." });
});

// --- Start server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app; // Export for testing convenience.
