"use strict";

const { Pool } = require("pg");

// Single shared connection pool. SSL is enabled in production (Render).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

module.exports = { pool };
