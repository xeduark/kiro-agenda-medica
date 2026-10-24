---
name: postgres-agenda
description: Diseña y evoluciona el esquema PostgreSQL de la agenda médica (pacientes, médicos, horarios y citas) con migraciones en SQL plano. La regla de negocio de que un médico no tenga dos citas solapadas en el mismo horario vive en la base de datos mediante una constraint EXCLUDE USING gist (o UNIQUE sobre médico + horario). Úsala al crear tablas, claves, índices, constraints o migraciones SQL de la agenda.
---

# Esquema PostgreSQL de la Agenda Médica

Modelo relacional para pacientes, médicos, horarios y citas. La integridad del
negocio se garantiza en la base de datos, no solo en la aplicación.

## Entidades y relaciones

- **patients**: personas que solicitan atención (nombre, contacto, documento).
- **doctors**: profesionales que atienden (nombre, especialidad).
- **schedules**: franjas de disponibilidad de cada médico.
- **appointments**: reserva de un tramo horario de un médico para un paciente.

Relaciones:
- `appointments.doctor_id` → `doctors.id`
- `appointments.patient_id` → `patients.id`
- `schedules.doctor_id` → `doctors.id`

## Regla de negocio crítica (en la base de datos)

> Un médico no puede tener dos citas en el mismo horario.

Esta regla NO se delega únicamente a la aplicación: se hace cumplir con una
constraint en PostgreSQL. Dos estrategias, de más fuerte a más simple:

### Opción A (recomendada) — EXCLUDE USING gist sobre rangos de tiempo

Permite modelar citas con duración y rechaza cualquier **solapamiento** de
tramos para el mismo médico, no solo coincidencias exactas de inicio.

Requiere la extensión `btree_gist` para combinar un tipo escalar (`doctor_id`)
con un rango (`tstzrange`) dentro del mismo índice GiST.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    doctor_id WITH =,
    time_range WITH &&
  )
  WHERE (status <> 'cancelled');
```

- `doctor_id WITH =` → la exclusión aplica dentro del mismo médico.
- `time_range WITH &&` → rechaza tramos que se **intersecten**.
- `WHERE (status <> 'cancelled')` → una cita cancelada libera el horario.

### Opción B (más simple) — UNIQUE sobre médico + horario

Suficiente si las citas se asignan a slots fijos e indivisibles (un
`schedule_id` por franja). Solo detecta coincidencias exactas de franja, no
solapamientos parciales.

```sql
ALTER TABLE appointments
  ADD CONSTRAINT appointments_doctor_slot_unique
  UNIQUE (doctor_id, schedule_id);
```

Regla práctica: si las citas tienen duración variable, usa la Opción A. Si
siempre caen en slots predefinidos, la Opción B basta.

## Convenciones del esquema

- Claves primarias `id` de tipo `bigint GENERATED ALWAYS AS IDENTITY`.
- Marcas de tiempo en `timestamptz` (UTC); evitar `timestamp` sin zona.
- `created_at` / `updated_at` en todas las tablas de negocio.
- Nombres de tablas y columnas en inglés, en `snake_case`, plural para tablas.
- Borrado lógico para citas (`status`) en lugar de `DELETE` físico, para no
  perder historial clínico.

## Migraciones en SQL plano

Archivos numerados y ordenados en `migrations/`, uno por cambio, idempotentes
cuando sea razonable. Sin ORM ni DSL: SQL que se puede leer y aplicar con
`psql`.

```
migrations/
  0001_init.sql          -- extensiones + patients + doctors
  0002_schedules.sql     -- franjas de disponibilidad por médico
  0003_appointments.sql  -- citas + constraint de no solapamiento
  0004_reminder_sent.sql -- marca de recordatorio enviado en citas
```

### migrations/0001_init.sql

```sql
-- Extensiones necesarias para constraints de exclusión por rango.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE patients (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name   text        NOT NULL,
    document_id text        NOT NULL UNIQUE,
    phone       text,
    email       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE doctors (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name  text        NOT NULL,
    specialty  text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

### migrations/0002_schedules.sql

```sql
-- Franjas de disponibilidad declaradas por cada médico.
CREATE TABLE schedules (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doctor_id  bigint      NOT NULL REFERENCES doctors (id),
    starts_at  timestamptz NOT NULL,
    ends_at    timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT schedules_time_valid CHECK (ends_at > starts_at)
);

CREATE INDEX schedules_doctor_idx ON schedules (doctor_id, starts_at);
```

### migrations/0003_appointments.sql

```sql
-- Citas: reservan un tramo de tiempo de un médico para un paciente.
CREATE TABLE appointments (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doctor_id  bigint      NOT NULL REFERENCES doctors (id),
    patient_id bigint      NOT NULL REFERENCES patients (id),
    schedule_id bigint     REFERENCES schedules (id),
    starts_at  timestamptz NOT NULL,
    ends_at    timestamptz NOT NULL,
    -- Rango generado para la constraint de exclusión.
    time_range tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at)) STORED,
    status     text        NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('confirmed', 'cancelled', 'completed')),
    -- Evita enviar el recordatorio dos veces (ver skill recordatorios-sqs).
    reminder_sent boolean   NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT appointments_time_valid CHECK (ends_at > starts_at)
);

-- Un médico no puede tener dos citas solapadas (citas canceladas no cuentan).
ALTER TABLE appointments
    ADD CONSTRAINT appointments_no_overlap
    EXCLUDE USING gist (
        doctor_id WITH =,
        time_range WITH &&
    )
    WHERE (status <> 'cancelled');

CREATE INDEX appointments_patient_idx ON appointments (patient_id);
CREATE INDEX appointments_doctor_day_idx ON appointments (doctor_id, starts_at);
```

### migrations/0004_reminder_sent.sql

```sql
-- Marca para no enviar el mismo recordatorio dos veces (ver recordatorios-sqs).
-- Nota: en una base nueva la columna ya existe por 0003; esta migración la
-- añade de forma idempotente en bases ya desplegadas.
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;

-- Localizar rápido las citas próximas pendientes de recordatorio.
CREATE INDEX IF NOT EXISTS appointments_pending_reminder_idx
    ON appointments (starts_at)
    WHERE reminder_sent = false AND status = 'confirmed';
```

Flujo de uso del campo:
- Al guardar la cita, `reminder_sent` empieza en `false`.
- Un proceso selecciona las citas próximas con `reminder_sent = false` y publica
  el mensaje en SQS (ver skill `recordatorios-sqs`).
- Tras publicar con éxito, marca `reminder_sent = true` para no reenviar.

## Verificación rápida

Tras aplicar las migraciones, confirma que el solapamiento se rechaza:

```sql
-- Esta segunda inserción debe fallar con la constraint appointments_no_overlap.
INSERT INTO appointments (doctor_id, patient_id, starts_at, ends_at)
VALUES (1, 1, '2026-01-10 09:00+00', '2026-01-10 09:30+00');

INSERT INTO appointments (doctor_id, patient_id, starts_at, ends_at)
VALUES (1, 2, '2026-01-10 09:15+00', '2026-01-10 09:45+00');  -- ERROR esperado
```

## Antipatrones a evitar

- Validar el solapamiento solo en la aplicación: una condición de carrera entre
  dos reservas simultáneas puede colar dos citas. La constraint lo impide.
- Usar `timestamp` sin zona horaria para `starts_at` / `ends_at`.
- `DELETE` físico de citas: rompería el historial. Usar `status = 'cancelled'`.
