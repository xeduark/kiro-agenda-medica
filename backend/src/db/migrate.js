"use strict";

// Plain-SQL migration runner. Applies every migrations/*.sql file in order.
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { pool } = require("./pool");

async function run() {
  const dir = path.join(__dirname, "..", "..", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    process.stdout.write(`Applying ${file}... `);
    await pool.query(sql);
    process.stdout.write("done\n");
  }

  await pool.end();
  console.log("All migrations applied.");
}

run().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
