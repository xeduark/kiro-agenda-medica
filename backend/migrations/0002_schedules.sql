-- Availability slots declared by each doctor.
CREATE TABLE IF NOT EXISTS schedules (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doctor_id  bigint      NOT NULL REFERENCES doctors (id),
    starts_at  timestamptz NOT NULL,
    ends_at    timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT schedules_time_valid CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS schedules_doctor_idx ON schedules (doctor_id, starts_at);
