# Agenda médica con Kiro — guía de construcción

**Proyecto:** sistema de citas médicas (pacientes, médicos, horarios, recordatorios).
**Stack:** React + Express (Node.js, TypeScript) + PostgreSQL. Frontend en AWS Amplify, backend y base de datos en Render.
**Regla de oro:** un commit por paso. Repo nuevo, creado el día del evento.

> Los pasos 0 y 1 del taller ya están hechos o se saltan. Aquí partimos de un
> paso **1b** que reemplaza el steering del POS por el de la agenda.
> Cada paso: pega el prompt en `kiro-cli --v3 chat`, revisa, haz commit.

---

## Paso 1b — Steering de la agenda (reemplaza el del POS)

Borra los steering del POS y pide:

```
Borra .kiro/steering/producto.md y tech.md y créalos de nuevo para una AGENDA
MÉDICA: pacientes, médicos, horarios y citas. Stack: React, Express (Node.js,
TypeScript) y PostgreSQL. Responde siempre en español. Regla de negocio: un médico no
puede tener dos citas en el mismo horario. Ambos con inclusion: always.
Deja frontend.md como fileMatch para *.tsx/*.jsx, quitando referencias al POS.
```

Commit: `steering: reglas de la agenda médica`

## Paso 2 — Arquitecto (solo lectura)

```
Crea .kiro/agents/arquitecto.json: arquitecto de soluciones AWS de solo lectura
(tools: fs_read, grep, glob, code). Propone la arquitectura de la agenda médica
y explica sin jerga de cloud. No escribe ni ejecuta nada.
```

Commit: `agents: arquitecto`

## Paso 3 — Equipo

```
Crea tres agentes más en .kiro/agents/: backend-dev (Express + pg, lee/escribe/ejecuta),
frontend-dev (React, lee/escribe/ejecuta) y reviewer (solo lectura, audita
seguridad y la regla de doble reserva). Los devs exponen las skills con
skill://.kiro/skills/**/SKILL.md. El reviewer va sin fs_write ni execute_bash.
```

Commit: `agents: backend, frontend y reviewer`

## Paso 4 — Orquestador

```
Crea .kiro/agents/tech-lead.json con la tool subagent. availableAgents y
trustedAgents: arquitecto, backend-dev, frontend-dev, reviewer. Reparte el
trabajo en paralelo y consolida resultados.
```

Commit: `agents: tech-lead orquestador`

## Paso 5 — Skills

```
Crea dos skills en .kiro/skills/:
1) postgres-agenda: esquema SQL de pacientes, médicos y citas. La regla de que
   un médico no tenga dos citas en el mismo horario vive en la base de datos con
   EXCLUDE USING gist (o UNIQUE sobre médico y horario). Migraciones en SQL plano.
2) deploy-render-amplify: frontend en AWS Amplify; backend Express y PostgreSQL
   en Render.
Descripciones específicas para que se activen solas.
```

Commit: `skills: postgres-agenda y deploy-render-amplify`

## Paso 6 — Hooks

```
Crea en .kiro/hooks/ (schema CLI v3):
- qa-tests.json: PostToolUse sobre fs_write, corre npm test en el backend.
- guard-shell.json: PreToolUse sobre execute_bash, bloquea rm -rf, sudo y
  cualquier comando que toque .env o datos de pacientes.
Prueba el guardia antes de confiar en él (es fail-closed).
```

Commit: `hooks: QA y guardia de shell`

## Paso 7 — MCP (draw.io)

```
Configura en .kiro/settings/mcp.json el servidor remoto https://mcp.draw.io/mcp
con autoApprove de create_diagram y get_drawio_reference. Luego, como
arquitecto, dibuja: React -> Express -> PostgreSQL.
```

Commit: `mcp: draw.io y diagrama de arquitectura`

## Paso 8 — Permisos

```
Crea .kiro/agents/deploy-ops.json: solo puede ejecutar git, npm, aws y psql. Con
permissions: deny para fs_read de **/.env y **/*.pem, deny para shell de
rm -rf *, sudo * y DROP DATABASE, allow para git/npm/aws/psql. Los datos de pacientes son
sensibles: nunca deben quedar en logs ni en el repo.
```

Commit: `permisos: agente deploy-ops`

## Paso 9 — Power

```
Empaqueta en .kiro/powers/agenda-kit/ un POWER.md (keywords: agenda, citas,
medico, paciente, postgres) con onboarding, steering y workflow de la idea al
MVP, más un mcp.json con draw.io.
```

Commit: `powers: agenda-kit`

## Paso 10 — Spec del MVP (en vivo)

```
Como arquitecto, crea un spec para el MVP: agendar una cita y rechazar si el
médico ya tiene una en ese horario. Genera requirements.md, design.md (con
diagrama) y tasks.md en .kiro/specs/agendar-cita/.
```

Commit: `specs: agendar-cita`

## Paso 11 — Implementación (lo que se demuestra)

```
Como tech-lead, ejecuta las tareas de tasks.md: backend-dev y frontend-dev en
paralelo, luego reviewer audita. Termina con deploy-ops.
```

Commits sugeridos: `backend: API de citas`, `frontend: formulario y listado`,
`deploy: frontend en Amplify, backend en Render`.

---

## Demo en vivo (2 minutos)

1. Agendar una cita para un médico.
2. Intentar otra en el mismo horario → se rechaza.
3. Mostrar el guardia de shell bloqueando `rm -rf /`.
4. Mostrar el historial de commits y la carpeta `.kiro/`.

## Publicación

Historia en Instagram y post en LinkedIn con @awsugmed y #KiroDayMedellin.
Cuenta qué herramientas de Kiro usaste.
