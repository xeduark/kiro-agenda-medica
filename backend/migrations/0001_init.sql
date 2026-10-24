-- Extensions needed for exclusion constraints over ranges.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS patients (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name   text        NOT NULL,
    document_id text        NOT NULL UNIQUE,
    phone       text,
    email       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctors (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name  text        NOT NULL,
    specialty  text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
