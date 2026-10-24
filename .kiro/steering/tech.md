---
inclusion: always
---

# Stack tecnológico

- **Frontend**: React (TypeScript).
- **Backend**: Express (Node.js, TypeScript).
- **Datos**: PostgreSQL.
- **Recordatorios**: Amazon SQS + AWS Lambda (avisos de citas asíncronos).
- **Despliegue**: frontend en AWS Amplify; backend y base de datos en Render.

## Convenciones
- Código y comentarios en inglés; comunicación con el usuario en español.
- Responder siempre en español.
- Nombres descriptivos; funciones pequeñas y con una sola responsabilidad.
- Tests para la lógica de negocio (citas, horarios, disponibilidad).
- Credenciales por variables de entorno; nada de secretos en el código ni en el repo.
- Datos de pacientes sensibles: nunca en logs ni en el repositorio.

## Reglas de negocio clave
- Un médico no puede tener dos citas en el mismo horario: validar solapamiento
  antes de confirmar cualquier cita.
