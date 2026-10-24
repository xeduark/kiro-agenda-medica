# Plan de implementación — MVP: Agendar una cita

- [ ] 1. Migración de base de datos: constraint de no solapamiento
  - Crear `migrations/0003_appointments.sql` (o verificar) con la tabla
    `appointments`, `time_range` generado, `status`, `reminder_sent`.
  - Añadir la constraint `appointments_no_overlap` (EXCLUDE USING gist) con
    `WHERE (status <> 'cancelled')` y la extensión `btree_gist`.
  - _Requisitos: 2.1, 2.2, 2.3_

- [ ] 2. Backend: capa de datos de citas
  - Implementar `appointmentsRepository.create` con `INSERT` parametrizado.
  - Implementar `appointmentsRepository.listByDoctorAndDate` para la agenda.
  - _Requisitos: 1.1, 1.2_

- [ ] 3. Backend: endpoint POST /appointments con validación y mapeo de errores
  - Validar payload (campos y `endsAt > startsAt`) → 400.
  - Llamar al repositorio; en éxito → 201 con la cita.
  - Capturar el error `23P01` de PostgreSQL → 409 con mensaje en español.
  - No registrar datos de paciente en logs.
  - _Requisitos: 1.1, 1.3, 2.1, 2.2, 4.1, 4.2_

- [ ] 4. Backend: endpoint GET /doctors/:id/appointments?date=
  - Devolver las citas del médico en la fecha para pintar la agenda del día.
  - _Requisitos: 3.3_

- [ ] 5. Backend: tests de la lógica de negocio
  - Horario libre → 201; solapamiento `confirmed` → 409; solapamiento con
    `cancelled` → 201; `endsAt <= startsAt` → 400; concurrencia → una sola.
  - _Requisitos: 1.1, 1.3, 2.1, 2.2, 2.3_

- [ ] 6. Frontend: componente AppointmentForm
  - Formulario accesible (labels, foco, ARIA) con paciente, médico, fecha y
    horas de inicio/fin. Componente funcional con hooks.
  - _Requisitos: 3.1, 3.4_

- [ ] 7. Frontend: integración con la API y manejo de respuestas
  - Enviar `POST /appointments`; en 201 confirmar y refrescar la agenda del día.
  - En 409 mostrar mensaje claro en español sin perder los datos del formulario.
  - Estado de la agenda centralizado en un único store.
  - _Requisitos: 3.2, 3.3_

- [ ] 8. Despliegue (deploy-ops)
  - Aplicar la migración en PostgreSQL de Render con `psql`.
  - Desplegar backend (Render) y frontend (Amplify) con git/npm/aws.
  - Verificar variables de entorno; sin secretos en el repo.
  - _Requisitos: 4.3_
