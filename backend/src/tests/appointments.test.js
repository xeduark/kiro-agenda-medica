"use strict";

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// Import the factory — we inject a mock repository to keep tests DB-free.
const { makeAppointmentsRouter } = require("../routes/appointments");

// ---------------------------------------------------------------------------
// Minimal Express request/response mocks
// ---------------------------------------------------------------------------

function makeReq(body = {}, params = {}, query = {}) {
  return { body, params, query };
}

function makeRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  return res;
}

// ---------------------------------------------------------------------------
// Helpers to extract the registered handler for a given method + path.
// We rely on Express's internal _router.stack, but avoid depending on its
// structure: instead we call the router as a function so Express resolves it.
// ---------------------------------------------------------------------------

/**
 * Calls the POST /appointments handler directly by running the router
 * through a fake req/res pair and collecting the first response written.
 */
function callPost(router, body) {
  return new Promise((resolve, reject) => {
    const req = makeReq(body);
    req.method = "POST";
    req.url = "/appointments";
    req.path = "/appointments";

    const res = makeRes();
    // Wrap res.json to resolve the promise.
    const originalJson = res.json.bind(res);
    res.json = function (b) {
      originalJson(b);
      resolve(res);
      return this;
    };

    const next = (err) => {
      if (err) reject(err);
      else resolve(res); // route not matched — shouldn't happen in these tests
    };

    router(req, res, next);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /appointments", () => {
  const VALID_BODY = {
    doctorId: 1,
    patientId: 2,
    startsAt: "2026-01-10T09:00:00Z",
    endsAt: "2026-01-10T09:30:00Z",
    scheduleId: null,
  };

  let mockRepo;

  beforeEach(() => {
    // Fresh mock before each test.
    mockRepo = {
      create: null,
      listByDoctorAndDate: async () => [],
    };
  });

  test("valid payload with free slot → calls repo.create and responds 201", async () => {
    const fakeAppointment = { id: 1, ...VALID_BODY, status: "confirmed" };
    let createCalled = false;

    mockRepo.create = async (params) => {
      createCalled = true;
      assert.equal(params.doctorId, VALID_BODY.doctorId);
      assert.equal(params.patientId, VALID_BODY.patientId);
      assert.equal(params.startsAt, VALID_BODY.startsAt);
      assert.equal(params.endsAt, VALID_BODY.endsAt);
      return fakeAppointment;
    };

    const router = makeAppointmentsRouter(mockRepo);
    const res = await callPost(router, VALID_BODY);

    assert.ok(createCalled, "repo.create should have been called");
    assert.equal(res._status, 201);
    assert.deepEqual(res._body, fakeAppointment);
  });

  test("repo throws 23P01 (overlap) → responds 409 with Spanish message", async () => {
    mockRepo.create = async () => {
      const err = new Error("exclusion constraint");
      err.code = "23P01";
      throw err;
    };

    const router = makeAppointmentsRouter(mockRepo);
    const res = await callPost(router, VALID_BODY);

    assert.equal(res._status, 409);
    assert.equal(res._body.error, "El médico ya tiene una cita en ese horario.");
  });

  test("endsAt <= startsAt → responds 400 without calling repo.create", async () => {
    let createCalled = false;
    mockRepo.create = async () => {
      createCalled = true;
    };

    const router = makeAppointmentsRouter(mockRepo);
    const res = await callPost(router, {
      ...VALID_BODY,
      endsAt: "2026-01-10T08:00:00Z", // before startsAt
    });

    assert.equal(res._status, 400);
    assert.ok(!createCalled, "repo.create must NOT be called on invalid time range");
  });

  test("endsAt === startsAt → responds 400 without calling repo.create", async () => {
    let createCalled = false;
    mockRepo.create = async () => {
      createCalled = true;
    };

    const router = makeAppointmentsRouter(mockRepo);
    const res = await callPost(router, {
      ...VALID_BODY,
      endsAt: VALID_BODY.startsAt, // same instant
    });

    assert.equal(res._status, 400);
    assert.ok(!createCalled, "repo.create must NOT be called when endsAt equals startsAt");
  });

  test("unexpected repo error → responds 500", async () => {
    mockRepo.create = async () => {
      throw new Error("unexpected DB failure");
    };

    const router = makeAppointmentsRouter(mockRepo);
    const res = await callPost(router, VALID_BODY);

    assert.equal(res._status, 500);
    assert.equal(res._body.error, "No se pudo agendar. Intenta de nuevo.");
  });

  test("missing required fields → responds 400 without calling repo.create", async () => {
    let createCalled = false;
    mockRepo.create = async () => {
      createCalled = true;
    };

    const router = makeAppointmentsRouter(mockRepo);
    // Missing patientId and endsAt.
    const res = await callPost(router, { doctorId: 1, startsAt: "2026-01-10T09:00:00Z" });

    assert.equal(res._status, 400);
    assert.ok(!createCalled, "repo.create must NOT be called when fields are missing");
  });
});

// ---------------------------------------------------------------------------
// PATCH /appointments/:id/status
// ---------------------------------------------------------------------------

function callPatch(router, id, body) {
  return new Promise((resolve, reject) => {
    const req = makeReq(body, { id });
    req.method = "PATCH";
    req.url = `/appointments/${id}/status`;
    const res = makeRes();
    const originalJson = res.json.bind(res);
    res.json = function (b) {
      originalJson(b);
      resolve(res);
      return this;
    };
    router(req, res, (err) => (err ? reject(err) : resolve(res)));
  });
}

describe("PATCH /appointments/:id/status", () => {
  test("cancel a confirmed appointment → 200", async () => {
    const repo = { updateStatus: async (id, status) => ({ id, status }) };
    const res = await callPatch(makeAppointmentsRouter(repo), "1", { status: "cancelled" });
    assert.equal(res._status, 200);
    assert.equal(res._body.status, "cancelled");
  });

  test("invalid status → 400 without touching repo", async () => {
    let called = false;
    const repo = { updateStatus: async () => { called = true; } };
    const res = await callPatch(makeAppointmentsRouter(repo), "1", { status: "deleted" });
    assert.equal(res._status, 400);
    assert.equal(called, false);
  });

  test("already closed or missing → 404", async () => {
    const repo = { updateStatus: async () => undefined };
    const res = await callPatch(makeAppointmentsRouter(repo), "1", { status: "completed" });
    assert.equal(res._status, 404);
  });
});
