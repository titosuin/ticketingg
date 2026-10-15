# Motor de Flujo y Despacho de Tickets Empresarial (DevSecOps)

Sistema empresarial de gestión, despacho y ciclo de vida de tickets de soporte con arquitectura resiliente, seguridad estricta basada en roles (RBAC), control de acceso a nivel de fila (RLS contra IDOR/BOLA), tokens de fencing contra split-brain, base de datos relacional SQLite y sanitización forense en Dead Letter Queue (DLQ).

---

## 🛡️ Arquitectura DevSecOps y Seguridad

- **Control de Acceso Basado en Roles (RBAC)**:
  - `system_admin`: Acceso irrestricto, configuración, auditoría completa y DLQ.
  - `ticket_admin`: Adquisición manual de leases, resolución/rechazo de tickets y gestión de colas.
  - `requester`: Creación de tickets de su departamento, consulta estricta de sus propios tickets.
- **Prevención de Escalamiento de Privilegios**:
  - Restricción estricta en el registro de usuarios: `ticket_admin` y `system_admin` requieren un `adminInviteToken` criptográfico verificado por tiempo constante.
  - Cuota máxima del sistema de 15 usuarios concurrentes (`MAX_SYSTEM_USERS_QUOTA = 15`).
- **Row-Level Security (RLS) contra IDOR / BOLA**:
  - `assertTicketOwnershipOrAdmin(requester, ticket)`: Los solicitantes (`requester`) únicamente pueden leer, actualizar o cancelar tickets creados por su propio `author.id`.
- **Fencing Tokens contra Split-Brain**:
  - Contador monotónico estricto (`ticket.fencingToken`) incrementado en cada adquisición de lease y verificado en la confirmación (`confirmResolution`). Si el lease expiró o fue reasignado, el commit tardío es rechazado con `SPLIT_BRAIN_STALE_FENCING_TOKEN`.
- **Sanitización Forense en DLQ**:
  - Sanitización automática y censura con `[REDACTED]` de tokens Bearer, contraseñas, api keys, tarjetas de crédito (PAN) y correos electrónicos en cargas fallidas y metadatos forenses.
- **Auditoría Inmutable**:
  - Registro de todas las transiciones de estado con actor, timestamp, fencing token y motivo en tabla relacional inmutable.
- **Protección contra Fuerza Bruta**:
  - Bloqueo temporal exponencial (lockout de 30 segundos tras 5 intentos fallidos) en autenticación.
  - Hashing seguro de contraseñas con sal y entropía evaluada.

---

## 👥 Usuarios Pre-sembrados (8 Usuarios)

El sistema incluye 8 cuentas pre-configuradas (2 administradores y 6 desarrolladores solicitantes):

| Usuario | Nombre | Rol | Departamento | Contraseña |
|---|---|---|---|---|
| `msilva_admin` | Mateo Silva | `system_admin` | DevOps & Cloud Platform | `M4t3o.S1lv4#2026!Sec` |
| `vrios_admin` | Valeria Ríos | `ticket_admin` | Infrastructure & SRE | `V4l3r14.R10s#2026!Sec` |
| `lbenitez` | Lucas Benítez | `requester` | Frontend Engineering | `Lbc-2026#DevSecure!` |
| `sherrera` | Sofía Herrera | `requester` | Backend Engineering | `Sh-2026#DevSecure!` |
| `dmorales` | Diego Morales | `requester` | Data Platform | `Dm-2026#DevSecure!` |
| `cvega` | Camila Vega | `requester` | Mobile Apps | `Cv-2026#DevSecure!` |
| `anavarro` | Andrés Navarro | `requester` | QA Automation | `An-2026#DevSecure!` |
| `mcastro` | Mariana Castro | `requester` | Security Ops | `Mc-2026#DevSecure!` |

---

## 🚀 Instalación y Ejecución

### Prerrequisitos
- Node.js >= 20.0.0
- npm >= 10.0.0

### Instalación de dependencias
```bash
npm install
```

### Inicialización de Base de Datos SQLite
```bash
npm run init:db
```
Crea el esquema relacional en `data/tickets.sqlite` con las tablas `users`, `tickets`, `audit_transitions` y `login_audit`.

### Ejecutar Pruebas Automatizadas
```bash
npm test
```
Ejecuta la suite completa de pruebas unitarias y de integración de seguridad (11 tests que validan RBAC, RLS, Fencing Tokens, DLQ y Cuotas).

### Modo Desarrollo
```bash
npm run dev
```
Inicia el servidor Vite en el puerto `3000` (accesible en `http://localhost:3000`).

### Compilación para Producción
```bash
npm run build
```

---

## 🔍 Preparado para Auditoría y Análisis Estático (Argon 4)

Este repositorio cumple con las directrices de seguridad de software y cadena de suministro:
- **Cero secretos en código**: Variables de entorno manejadas mediante `.env.example` y `.gitignore`.
- **Tipado estricto**: TypeScript 5+ con verificación estricta de tipos.
- **Validación de entradas**: Sanitización forense contra inyecciones y mitigación de OWASP Top 10 (A01: Broken Access Control, A02: Cryptographic Failures, A07: Identification and Authentication Failures).