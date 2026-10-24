#!/usr/bin/env node
// guard-shell.js — cross-platform hook guard (Node, no external dependencies)
// Reads the tool-use event from stdin as JSON.
// Exits with code 2 (blocked) if the command contains dangerous patterns.
// Fail-closed: also exits 2 if stdin is empty or JSON cannot be parsed.

const BLOCKED_PATTERNS = [
  /rm\s+-[a-z]*r/i,        // rm -r, rm -rf, rm -fr, etc.
  /rm\s+--recursive/i,     // rm --recursive
  /\bsudo\b/i,
  /\.env(\b|$)/i,
  /\bsecrets?\b/i,
  /\bcredentials?\b/i,
  /\bpatients\b/i,
  /\bpacientes\b/i,
];

function isBlocked(command) {
  return BLOCKED_PATTERNS.some((re) => re.test(command));
}

let raw = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });

process.stdin.on("end", () => {
  // Fail-closed: empty stdin
  if (!raw.trim()) {
    process.stderr.write("BLOCKED: empty stdin (fail-closed).\n");
    process.exit(2);
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch (_) {
    process.stderr.write("BLOCKED: could not parse event JSON (fail-closed).\n");
    process.exit(2);
  }

  // Extract the command from the event payload.
  // Kiro passes tool input under event.input or event.tool_input.
  const input = event.input ?? event.tool_input ?? {};
  const command = (input.command ?? input.cmd ?? "").toString();

  if (!command.trim()) {
    // No command field found — fail-closed.
    process.stderr.write("BLOCKED: no command field in event (fail-closed).\n");
    process.exit(2);
  }

  if (isBlocked(command)) {
    process.stderr.write(
      `BLOCKED: dangerous or sensitive pattern detected in: ${command}\n`
    );
    process.exit(2);
  }

  process.exit(0);
});
