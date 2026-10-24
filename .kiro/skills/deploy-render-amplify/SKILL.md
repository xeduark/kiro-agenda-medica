---
name: deploy-render-amplify
description: Despliega la agenda médica con el frontend React en AWS Amplify Hosting y el backend Express + PostgreSQL en Render. Úsala al publicar, desplegar o configurar hosting, CI/CD, variables de entorno o la base de datos gestionada de la aplicación.
---

# Desplegar la Agenda Médica (Amplify + Render)

Arquitectura de despliegue:

- **Frontend (React)** → AWS Amplify Hosting.
- **Backend (Express)** → Web Service en Render.
- **Base de datos (PostgreSQL)** → Render PostgreSQL gestionado.

```
Navegador ──▶ Amplify (React, estático + CDN)
                   │  llamadas API (HTTPS)
                   ▼
            Render Web Service (Express)
                   │                   │  sqs:SendMessage
                   ▼                   ▼
            Render PostgreSQL     Cola SQS (AWS) ──▶ Lambda ──▶ recordatorio
             (gestionado)              │
                                       ▼
                                   Cola DLQ (AWS)
```

## 1. Base de datos — Render PostgreSQL

1. En Render: **New → PostgreSQL**. Elegir región y plan.
2. Copiar la **Internal Database URL** (para el backend en Render) y la
   **External Database URL** (para migraciones desde tu máquina).
3. Aplicar las migraciones SQL (ver skill `postgres-agenda`):
   ```sh
   psql "$EXTERNAL_DATABASE_URL" -f migrations/0001_init.sql
   psql "$EXTERNAL_DATABASE_URL" -f migrations/0002_schedules.sql
   psql "$EXTERNAL_DATABASE_URL" -f migrations/0003_appointments.sql
   ```
4. La base interna solo es accesible por servicios del mismo equipo en Render;
   usa SSL en conexiones externas.

## 2. Backend Express — Render Web Service

1. En Render: **New → Web Service**, conectar el repositorio.
2. Configuración de build y arranque:
   - **Build command**: `npm ci`
   - **Start command**: `node server.js` (o `npm start`)
   - **Health check path**: `/health`
3. Variables de entorno:
   - `DATABASE_URL` → **Internal Database URL** del PostgreSQL de Render.
   - `NODE_ENV=production`
   - `PORT` → Render la inyecta; el servidor debe leer `process.env.PORT`.
   - `CORS_ORIGIN` → dominio del frontend en Amplify.
   - `AWS_REGION` → región de la cola SQS (p. ej. `us-east-1`).
   - `REMINDERS_QUEUE_URL` → URL de la cola `agenda-reminders`.
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` → credenciales del usuario IAM
     que SOLO puede `sqs:SendMessage` (ver skill `recordatorios-sqs`).
   Estas credenciales van en el panel de Render, NUNCA en el repo.
4. El servidor debe escuchar en `0.0.0.0` y en `process.env.PORT`:
   ```js
   const port = process.env.PORT || 3000;
   app.listen(port, "0.0.0.0");
   ```
5. Conexión a PostgreSQL con SSL en producción:
   ```js
   const { Pool } = require("pg");
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     ssl: process.env.NODE_ENV === "production"
       ? { rejectUnauthorized: false }
       : false,
   });
   ```
6. CI/CD: cada push a la rama conectada dispara un auto-deploy en Render.

## 3. Frontend React — AWS Amplify Hosting

1. En Amplify: **New app → Host web app**, conectar el repositorio.
2. Build settings (React + Vite):
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
   (Para Create React App el output es `build`.)
3. Variable de entorno con la URL pública del backend en Render:
   - `VITE_API_URL=https://<tu-servicio>.onrender.com`
   El cliente la consume con `import.meta.env.VITE_API_URL`.
4. CI/CD: Amplify reconstruye y publica en cada push a la rama conectada.

## 4. Conectar frontend y backend (CORS)

- En el backend, habilitar CORS solo para el dominio de Amplify:
  ```js
  const cors = require("cors");
  app.use(cors({ origin: process.env.CORS_ORIGIN }));
  ```
- `CORS_ORIGIN` debe ser el dominio final de Amplify (p. ej.
  `https://main.xxxx.amplifyapp.com` o tu dominio propio).

## 5. Recordatorios — cola SQS y Lambda (AWS)

El detalle de diseño (mensaje autosuficiente, IAM mínimo, DLQ) está en la skill
`recordatorios-sqs`. Aquí van los pasos de despliegue de la infraestructura.

### 5.1 Crear las colas SQS

1. En AWS SQS, crear la DLQ primero: `agenda-reminders-dlq` (cola estándar).
2. Crear la cola principal `agenda-reminders` con **RedrivePolicy** apuntando a
   la DLQ y `maxReceiveCount` (p. ej. 5).
3. Anotar la **URL** y el **ARN** de la cola principal.

### 5.2 Permisos IAM

1. Usuario IAM para el backend con política de SOLO `sqs:SendMessage` sobre el
   ARN de `agenda-reminders`. Generar sus claves de acceso → irán a Render como
   `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
2. Rol de ejecución de la Lambda con SOLO `sqs:ReceiveMessage`,
   `sqs:DeleteMessage` y `sqs:GetQueueAttributes` sobre la misma cola.
   La Lambda NO usa claves: toma permisos de su rol.

### 5.3 Desplegar la Lambda consumidora

1. Empaquetar `lambda/reminder-consumer/` (código Node.js + dependencias).
2. Crear la función Lambda (runtime Node.js) con el rol de ejecución anterior.
3. Añadir un **event source mapping** desde `agenda-reminders` a la Lambda con
   `ReportBatchItemFailures` activado (reintenta solo el mensaje fallido).
4. La Lambda NO necesita variables de base de datos: el mensaje es autosuficiente.

### 5.4 Configurar el backend en Render

Añadir en el Web Service de Render las variables de la sección 2:
`AWS_REGION`, `REMINDERS_QUEUE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
Nunca en el repositorio.

## Checklist antes de publicar

- [ ] Migraciones aplicadas en el PostgreSQL de Render (incluye `reminder_sent`).
- [ ] `DATABASE_URL` configurada en el Web Service (URL interna).
- [ ] Backend lee `process.env.PORT` y escucha en `0.0.0.0`.
- [ ] Endpoint `/health` responde 200 para el health check de Render.
- [ ] `VITE_API_URL` en Amplify apunta al backend de Render.
- [ ] `CORS_ORIGIN` en el backend apunta al dominio de Amplify.
- [ ] Colas `agenda-reminders` y `agenda-reminders-dlq` creadas con RedrivePolicy.
- [ ] Usuario IAM del backend: solo `sqs:SendMessage`.
- [ ] Rol de la Lambda: solo recibir/borrar/atributos de la cola.
- [ ] `AWS_REGION`, `REMINDERS_QUEUE_URL` y credenciales AWS en Render.
- [ ] Sin secretos en el repo: todo por variables de entorno.

## Orden de despliegue recomendado

1. PostgreSQL en Render (y aplicar migraciones).
2. Colas SQS (DLQ y principal) + roles/usuarios IAM en AWS.
3. Lambda consumidora + event source mapping desde la cola.
4. Backend Express en Render (depende de la base y de la URL de la cola).
5. Frontend en Amplify (depende de la URL del backend).
6. Ajustar `CORS_ORIGIN` con el dominio real de Amplify una vez conocido.

## Antipatrones a evitar

- Poner la `DATABASE_URL` o claves en el código o en el repo.
- Hardcodear la URL del backend en el frontend en vez de usar una variable de
  entorno de build.
- Olvidar SSL en la conexión a PostgreSQL en producción.
- Usar la External Database URL desde el backend en Render (usar la interna,
  más rápida y sin salir a internet).
