-- Appointments: reserve a doctor's time range for a patient.
CREATE TABLE IF NOT EXISTS appointments (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doctor_id   bigint      NOT NULL REFERENCES doctors (id),
    patient_id  bigint      NOT NULL REFERENCES patients (id),
    schedule_id bigint      REFERENCES schedules (id),
    starts_at   timestamptz NOT NULL,
    ends_at     timestamptz NOT NULL,
    -- Range generated for the exclusion constraint.
    time_range  tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at)) STORED,
    status      text        NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed', 'cancelled', 'completed')),
    -- Avoid sending the same reminder twice.
    reminder_sent boolean   NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT appointments_time_valid CHECK (ends_at > starts_at)
);

-- A doctor cannot have two overlapping appointments (cancelled ones are freed).
ALTER TABLE appointments
    DROP CONSTRAINT IF EXISTS appointments_no_overlap;
ALTER TABLE appointments
    ADD CONSTRAINT appointments_no_overlap
    EXCLUDE USING gist (
        doctor_id WITH =,
        time_range WITH &&
    )
    WHERE (status <> 'cancelled');

CREATE INDEX IF NOT EXISTS appointments_patient_idx ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS appointments_doctor_day_idx ON appointments (doctor_id, starts_at);
