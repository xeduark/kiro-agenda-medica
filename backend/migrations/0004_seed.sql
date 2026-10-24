-- Seed data for local development and testing.
-- Idempotent: ON CONFLICT DO NOTHING prevents duplicate inserts.

INSERT INTO doctors (full_name, specialty)
VALUES
    ('Dra. Ana García', 'Cardiología'),
    ('Dr. Luis Méndez', 'Medicina General')
ON CONFLICT DO NOTHING;

INSERT INTO patients (full_name, document_id)
VALUES
    ('Carlos Pérez', '12345678'),
    ('María López', '87654321')
ON CONFLICT (document_id) DO NOTHING;
