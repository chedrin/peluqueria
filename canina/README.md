# CANIA · CRM para Peluquería y Estética Canina

CRM completo para un salón de peluquería canina, con dos áreas:

- **#administración** (`/admin`): agenda multiespecialista con drag-and-drop, fichas clínicas/estéticas de cada perro, clientes, servicios y tarifas por tamaño/pelo, bonos, fidelización, caja y facturación legal española (tickets, facturas completas y rectificativas, PDF con QR, registro inalterable).
- **#cliente** (web pública + `/mi-cuenta`): catálogo, reserva online con huecos en tiempo real, mis mascotas (con fotos antes/después), mis citas (cancelar/reprogramar según política), saldo de puntos, sellos y bonos. Banner de cookies AEPD y páginas legales (LSSI-CE, RGPD, cancelación).

**Stack:** Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 + componentes shadcn/ui · PostgreSQL 16 + Prisma 6 · dnd-kit · @react-pdf/renderer · Zod · Vitest.

## Puesta en marcha (puerto 3025)

```bash
cd canina
cp .env.example .env          # pon un AUTH_SECRET propio
docker compose up -d          # PostgreSQL en localhost:5433
npm install
npx prisma migrate deploy     # crea tablas + triggers de inalterabilidad
npm run db:seed               # datos de demo
npm run dev                   # http://localhost:3025
```

Usuarios de demo (contraseña `cania1234`):

| Email | Rol | Entra en |
|---|---|---|
| admin@cania.test | ADMIN | /admin/agenda |
| recepcion@cania.test | RECEPTION | /admin/agenda |
| laura@cania.test | GROOMER | /admin/agenda |
| cliente@cania.test | CLIENT | /mi-cuenta |

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` / `npm start` | Next.js en el puerto **3025** |
| `npm test` | Tests unitarios de dominio (facturación, bonos, agenda, tarifas…) |
| `INTEGRATION=1 npm test` | + tests de integración contra PostgreSQL (requiere seed) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Nueva migración en desarrollo |

## Documentación

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): capas, carpetas, modelo de datos y los tres flujos clave (drag-and-drop, factura, bono).
- [docs/IDEAS-OPEN-SOURCE.md](docs/IDEAS-OPEN-SOURCE.md): repositorios de referencia (>1000★) y qué se ha tomado de cada uno.

## Pendiente para producción

- Subida de fotos a un almacenamiento (S3/R2/Supabase Storage); hoy se guarda la URL.
- Proveedor real de email (SMTP/Resend) y plantillas de WhatsApp Cloud API aprobadas por Meta (el adaptador ya existe en `features/booking/server/notifications.ts`).
- Envío de registros a la AEAT (modalidad VERI*FACTU) y declaración responsable del software: la huella encadenada y el QR ya están implementados.
- Revisar los textos legales (campos entre corchetes) con la asesoría.
