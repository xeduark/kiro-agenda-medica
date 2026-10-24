# Requisitos — MVP: Agendar una cita

## Introducción

Esta feature permite al personal administrativo agendar una cita para un
paciente con un médico en un horario concreto. La regla de negocio central es
que un médico no puede tener dos citas que se solapen en el mismo horario: si
el horario ya está ocupado, el sistema debe rechazar la cita con un mensaje
claro. La integridad se garantiza en la base de datos (PostgreSQL), no solo en
la aplicación.

Stack: React (Amplify) → Express (Render) → PostgreSQL (Render).

## Requisitos

### Requisito 1: Agendar una cita válida

**Historia de usuario:** Como personal administrativo, quiero agendar una cita
para un paciente con un médico en una fecha y hora, para reservar la atención.

#### Criterios de aceptación
1. CUANDO el usuario envía una cita con paciente, médico, hora de inicio y hora
   de fin válidos Y el médico no tiene otra cita que se solape EN ESE RANGO,
   ENTONCES el sistema DEBERÁ crear la cita y responder con estado 201 y los
   datos de la cita creada.
2. CUANDO se crea la cita ENTONCES el sistema DEBERÁ guardarla con estado
   `confirmed` y `reminder_sent = false`.
3. SI la hora de fin no es posterior a la hora de inicio ENTONCES el sistema
   DEBERÁ rechazar la petición con estado 400 y un mensaje de validación.

### Requisito 2: Rechazar cita solapada (regla crítica)

**Historia de usuario:** Como consultorio, quiero que el sistema impida dos
citas del mismo médico en el mismo horario, para no provocar dobles reservas.

#### Criterios de aceptación
1. CUANDO el usuario intenta agendar una cita para un médico que YA tiene una
   cita no cancelada que se solapa con el rango solicitado ENTONCES el sistema
   DEBERÁ rechazar la cita con estado 409 (conflicto) y un mensaje claro en
   español.
2. CUANDO dos peticiones solapadas para el mismo médico llegan de forma
   concurrente ENTONCES la base de datos DEBERÁ impedir que ambas se guarden
   (constraint de exclusión), y el sistema DEBERÁ traducir ese error a una
   respuesta 409.
3. CUANDO la cita que ocupaba el horario está en estado `cancelled` ENTONCES el
   sistema DEBERÁ permitir agendar una nueva cita en ese horario.

### Requisito 3: Interfaz de agendamiento

**Historia de usuario:** Como personal administrativo sin formación técnica,
quiero un formulario simple para agendar, para hacerlo sin equivocarme.

#### Criterios de aceptación
1. CUANDO abro el formulario de nueva cita ENTONCES DEBERÁ permitirme elegir
   paciente, médico, fecha, hora de inicio y hora de fin.
2. CUANDO el backend rechaza la cita por solapamiento (409) ENTONCES la UI
   DEBERÁ mostrar un mensaje claro en español ("El médico ya tiene una cita en
   ese horario") sin perder los datos del formulario.
3. CUANDO la cita se crea con éxito ENTONCES la UI DEBERÁ confirmarlo y mostrar
   la cita en la agenda del día del médico.
4. El formulario DEBERÁ ser accesible: etiquetas asociadas, foco de teclado y
   roles ARIA en los mensajes de error.

### Requisito 4: Seguridad y datos sensibles

**Historia de usuario:** Como responsable del consultorio, quiero que los datos
de pacientes estén protegidos, para cumplir con la privacidad.

#### Criterios de aceptación
1. El sistema DEBERÁ validar y sanear las entradas antes de tocar la base de
   datos (consultas parametrizadas, sin concatenar SQL).
2. El sistema NO DEBERÁ registrar datos identificables de pacientes en logs.
3. El sistema NO DEBERÁ incluir secretos ni credenciales en el código ni en el
   repositorio; las credenciales van por variables de entorno.
