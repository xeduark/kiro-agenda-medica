-- Seed data for local development and the demo. Idempotent.
INSERT INTO doctors (full_name, specialty)
SELECT v.full_name, v.specialty
FROM (VALUES ('Dra. Ana García', 'Cardiología'),
             ('Dr. Luis Méndez', 'Medicina General')) AS v(full_name, specialty)
WHERE NOT EXISTS (SELECT 1 FROM doctors d WHERE d.full_name = v.full_name);

INSERT INTO patients (full_name, document_id)
VALUES ('Carlos Pérez', '12345678'),
       ('María López', '87654321')
ON CONFLICT (document_id) DO NOTHING;
