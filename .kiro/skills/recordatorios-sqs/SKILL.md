---
name: recordatorios-sqs
description: Envía recordatorios de citas de la agenda médica de forma asíncrona con Amazon SQS y AWS Lambda. Cuando el backend Express guarda una cita en PostgreSQL, publica un mensaje en una cola SQS con los datos de la cita (paciente, médico, fecha y hora) y una Lambda en Node.js consume la cola y envía el aviso. Úsala al hablar de recordatorios, avisos, notificaciones, colas o mensajería asíncrona de citas.
---

# Recordatorios de citas con SQS + Lambda

Envío de recordatorios desacoplado del guardado de la cita. El backend no envía
el aviso directamente: publica un mensaje y una Lambda lo procesa aparte. Así
una caída del proveedor de notificaciones no bloquea el agendamiento.

```
Express (al guardar la cita en PostgreSQL)
      │  sqs:SendMessage
      ▼
   Cola SQS  ──(entrega)──▶  Lambda (Node.js)  ──▶  envía el recordatorio
      │                           │
      │  (fallos tras N intentos) │
      ▼                           │
   Cola DLQ  ◀────────────────────┘
```

## Principio clave: el mensaje es autosuficiente

La Lambda **NO se conecta a PostgreSQL**. El mensaje publicado trae TODO lo
necesario para enviar el recordatorio. Esto mantiene la Lambda simple, sin
credenciales de base de datos y sin acoplarse al esquema.

Forma del mensaje (JSON):

```json
{
  "appointmentId": 1234,
  "patient": { "fullName": "Ana Pérez", "phone": "+57...", "email": "ana@..." },
  "doctor": { "fullName": "Dr. Gómez", "specialty": "Cardiología" },
  "startsAt": "2026-01-10T09:00:00Z",
  "endsAt": "2026-01-10T09:30:00Z"
}
```

## 1. Publicar desde Express al guardar la cita

Tras confirmar la cita en PostgreSQL (dentro o justo después de la transacción),
el backend publica el mensaje. Usa el SDK v3 de AWS.

```js
// src/reminders/publisher.js
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

// La región y la URL de la cola vienen por variables de entorno, NUNCA del repo.
const sqs = new SQSClient({ region: process.env.AWS_REGION });

async function publishReminder(appointment) {
  const body = JSON.stringify({
    appointmentId: appointment.id,
    patient: {
      fullName: appointment.patient.fullName,
      phone: appointment.patient.phone,
      email: appointment.patient.email,
    },
    doctor: {
      fullName: appointment.doctor.fullName,
      specialty: appointment.doctor.specialty,
    },
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
  });

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: process.env.REMINDERS_QUEUE_URL,
      MessageBody: body,
    })
  );
}

module.exports = { publishReminder };
```

Nota: publica solo tras confirmar el guardado. Si el `SendMessage` falla, no
revientes la respuesta de la cita; registra el error y deja que un reintento o
un proceso de barrido lo reencole (la cita ya está a salvo en PostgreSQL).

## 2. Lambda consumidora (Node.js)

La Lambda recibe lotes de mensajes de SQS, envía el recordatorio y no toca la
base de datos.

```js
// lambda/reminder-consumer/index.js
exports.handler = async (event) => {
  const failures = [];

  for (const record of event.Records) {
    try {
      const msg = JSON.parse(record.body);
      await sendReminder(msg); // SMS/email; el mensaje ya trae todos los datos
    } catch (err) {
      console.error("reminder failed", record.messageId, err);
      // Report batch item failure para que SQS reintente solo este mensaje.
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures: failures };
};

async function sendReminder(msg) {
  // Integración con el proveedor de notificaciones (SMS/email).
  // No hay conexión a PostgreSQL aquí: el mensaje es autosuficiente.
}
```

Configura el event source mapping con `ReportBatchItemFailures` para que solo
se reintenten los mensajes que fallaron, no el lote completo.

## 3. Cola de mensajes fallidos (DLQ)

Toda cola de trabajo debe tener una **Dead Letter Queue**. Los mensajes que
fallan tras `maxReceiveCount` intentos van a la DLQ para inspección manual, en
vez de reintentarse para siempre.

- Crear dos colas: `agenda-reminders` (principal) y `agenda-reminders-dlq`.
- En la principal, configurar la `RedrivePolicy` apuntando a la DLQ con
  `maxReceiveCount` (p. ej. 5).
- Revisar la DLQ periódicamente: mensajes ahí = recordatorios que nunca se
  enviaron y requieren atención.

## 4. Permisos IAM mínimos (mínimo privilegio)

Cada parte recibe SOLO el permiso que necesita.

- **Backend Express** → únicamente `sqs:SendMessage` sobre la cola principal.

  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "sqs:SendMessage",
        "Resource": "arn:aws:sqs:<region>:<account-id>:agenda-reminders"
      }
    ]
  }
  ```

- **Lambda consumidora** → solo lectura/borrado de su cola para consumir.

  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ],
        "Resource": "arn:aws:sqs:<region>:<account-id>:agenda-reminders"
      }
    ]
  }
  ```

El backend NO puede leer la cola; la Lambda NO puede publicar. Nadie tiene
permisos de más.

## 5. Credenciales de AWS por variables de entorno (nunca en el repo)

- El backend en Render recibe las credenciales por variables de entorno
  (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) y la
  `REMINDERS_QUEUE_URL`. Ver la skill `deploy-render-amplify`.
- La Lambda NO usa claves de acceso: toma permisos de su **rol de ejecución**
  IAM. No se guardan credenciales en su código.
- Prohibido commitear claves, URLs de cola con credenciales o ARNs sensibles.
  Usa `.env` local (en `.gitignore`) y las variables del panel de Render/AWS.

## Checklist

- [ ] Colas `agenda-reminders` y `agenda-reminders-dlq` creadas, con RedrivePolicy.
- [ ] El mensaje incluye paciente, médico, fecha y hora (autosuficiente).
- [ ] La Lambda NO se conecta a PostgreSQL.
- [ ] Event source mapping con `ReportBatchItemFailures`.
- [ ] Política del backend: solo `sqs:SendMessage`.
- [ ] Rol de la Lambda: solo `ReceiveMessage`/`DeleteMessage`/`GetQueueAttributes`.
- [ ] Credenciales y URL de la cola por variables de entorno, no en el repo.
- [ ] Marcar `reminder_sent` en la cita para no reenviar (ver `postgres-agenda`).

## Antipatrones a evitar

- Que la Lambda consulte PostgreSQL: rompe el desacoplamiento y le mete
  credenciales de base de datos.
- Enviar el recordatorio de forma síncrona dentro del request de la cita: un
  proveedor lento o caído bloquearía el agendamiento.
- Cola sin DLQ: mensajes fallidos se reintentan sin fin o se pierden.
- Permisos `sqs:*` o comodines de recurso: viola el mínimo privilegio.
- Claves de AWS en el código o el repositorio.
