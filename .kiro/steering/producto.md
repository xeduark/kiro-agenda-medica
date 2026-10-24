---
inclusion: always
---

# Producto: Agenda Médica

## Qué estamos construyendo
Un sistema de agenda médica para gestionar pacientes, médicos, horarios y citas
en un consultorio o clínica pequeña.

## Entidades núcleo
- **Pacientes**: personas que solicitan atención (nombre, contacto, documento).
- **Médicos**: profesionales que atienden (nombre, especialidad).
- **Horarios**: franjas de disponibilidad de cada médico.
- **Citas**: reserva de un horario de un médico para un paciente.

## Funcionalidades núcleo (MVP)
1. Gestionar pacientes (alta, consulta, edición).
2. Gestionar médicos y sus especialidades.
3. Definir horarios de disponibilidad por médico.
4. Agendar, reprogramar y cancelar citas.
5. Ver la agenda del día por médico.

## Reglas de negocio
- Un médico no puede tener dos citas en el mismo horario.

## Principios
- Simple antes que completo: primero el MVP, luego extras.
- Pensado para personal administrativo SIN conocimientos técnicos operándolo.
- Español como idioma del producto y de la comunicación del equipo.
- Responder siempre en español.
