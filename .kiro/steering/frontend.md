---
inclusion: fileMatch
fileMatchPattern: "**/*.{tsx,jsx}"
---

# Reglas de Frontend

- Componentes funcionales con hooks; nada de componentes de clase.
- La UI debe ser usable por personal administrativo sin formación técnica:
  botones grandes, textos claros en español, confirmaciones antes de acciones
  irreversibles (como cancelar una cita).
- Accesibilidad: roles ARIA y foco de teclado en los formularios de pacientes,
  horarios y citas.
- Estado de la agenda centralizado (un solo lugar de verdad).
