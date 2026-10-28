# Arquitectura técnica

## 1. Visión general

```
                ┌──────────────────────── Next.js 15 (puerto 3025) ────────────────────────┐
 Navegador ───► │ middleware.ts  → control de acceso por rol (/admin staff, /mi-cuenta cliente)│
                │                                                                          │
                │ app/ (rutas finas: solo componen)                                        │
                │   (public)/  (auth)/  mi-cuenta/  admin/  api/                            │
                │        │                                                                 │
                │        ▼                                                                 │
                │ features/<dominio>/                                                       │
                │   domain/      lógica PURA (sin I/O) → testeada con Vitest               │
                │   server/      servicios + server actions (Prisma, transacciones, audit) │
                │   components/  UI del dominio (cliente/servidor)                          │
                │        │                                                                 │
                │ lib/  prisma · auth/sesión · tiempo (Europe/Madrid) · dinero · errores   │
                └────────┼─────────────────────────────────────────────────────────────────┘
                         ▼
                 PostgreSQL 16  (+ triggers de inalterabilidad, índices parciales, CHECKs)
```

Principios:

- **Organización por dominio (feature-sliced):** cada carpeta de `features/` es autocontenida. Las rutas de `app/` no contienen lógica de negocio.
- **Dominio puro separado de la infraestructura:** cálculo fiscal, reglas de bonos, motor de disponibilidad y geometría de la agenda son funciones puras. Se reutilizan en servidor (para decidir) y en UI (para previsualizar), y se testean sin base de datos.
- **Server Actions con resultado tipado:** `toActionResult()` convierte `DomainError` en `{ ok:false, code, message }` que la UI muestra como toast; los errores inesperados no filtran detalles.
- **Dinero en céntimos (Int)** y porcentajes en *basis points* (2100 = 21 %). Sin coma flotante.
- **Zona horaria explícita** (`Europe/Madrid`) en `lib/time.ts`: la agenda trabaja en «minutos del día local», cubierto por tests de horario de verano/invierno.
- **Trazabilidad:** toda mutación relevante escribe en `AuditLog` (append-only por trigger).

## 2. Estructura de carpetas

```
canina/
├── prisma/
│   ├── schema.prisma            # modelo relacional completo
│   ├── migrations/              # SQL + triggers de inalterabilidad fiscal
│   └── seed.ts                  # datos de demo
├── src/
│   ├── middleware.ts            # RBAC por área
│   ├── app/
│   │   ├── (public)/            # home/catálogo, /reservar, /legal/[slug]
│   │   ├── (auth)/              # /login, /registro (casillas RGPD)
│   │   ├── mi-cuenta/           # área privada: mascotas, citas, fidelidad
│   │   ├── admin/               # agenda, clientes, perros, servicios, bonos, fidelidad, caja, facturas
│   │   └── api/                 # availability, cookie-consent, invoices/[id]/pdf
│   ├── components/
│   │   ├── ui/                  # primitivas shadcn/ui (button, card, badge, input, table)
│   │   ├── layout/              # cabeceras, pie, sidebar admin
│   │   └── legal/CookieBanner.tsx
│   ├── features/
│   │   ├── agenda/              # tablero DnD, panel de cita, bloqueos, máquina de estados
│   │   ├── scheduling/          # motor de disponibilidad (huecos, conflictos)
│   │   ├── booking/             # reserva online, cancelar/reprogramar, notificaciones
│   │   ├── catalog/             # servicios y matriz de tarifas tamaño × pelo
│   │   ├── dogs/                # ficha, alertas de salud, registro técnico, galería
│   │   ├── owners/              # propietario y preferencias
│   │   ├── vouchers/            # bonos: venta, consumo, reversión
│   │   ├── loyalty/             # puntos/sellos y reglas configurables
│   │   ├── billing/             # cálculo fiscal, validación, NIF, Veri*Factu, PDF, cobros
│   │   ├── legal/               # textos legales versionados, categorías de cookies
│   │   └── auth/                # login/registro/logout
│   └── lib/                     # prisma, auth, session (edge), time, money, errors, audit
└── tests/                       # unitarios + integración (INTEGRATION=1)
```

## 3. Modelo de datos (resumen)

Entidades pedidas → tablas: `User` (roles ADMIN, GROOMER, RECEPTION, CLIENT), `Dog`, `Appointment`, `Service`, `ServicePricing`, `GroomingRecord`, `Voucher`, `LoyaltyCard`, `Invoice`, `InvoiceItem`, `AuditLog`.

Tablas de apoyo: `OwnerProfile` / `StaffProfile` (datos según rol), `WorkingHours`, `TimeBlock` (descansos, bajas, incidencias), `Breed`, `HealthAlert`, `DogWeight`, `GroomingPhoto`, `ServiceCategory`, `StaffService` (qué peluquero hace qué), `AppointmentService` (líneas con precio *snapshot*), `VoucherProduct` (+ servicios incluidos), `VoucherRedemption`, `LoyaltyProgram`, `LoyaltyTransaction`, `InvoiceSeries`, `Payment`, `Consent`, `CookieConsentLog`, `NotificationLog`, `BusinessSettings`, `Product`.

Reglas que viven en la base de datos (no solo en el código):

| Regla | Mecanismo |
|---|---|
| Factura emitida inalterable (solo ISSUED → VOIDED) | trigger `invoice_immutable` |
| Líneas de factura emitida inalterables | trigger `invoice_item_immutable` |
| Cobros y auditoría append-only | trigger `cania_append_only` |
| Numeración única por serie | `@@unique([seriesId, number])` + `fullNumber @unique` |
| Una sola redención activa por línea de servicio | índice único parcial `WHERE "reversedAt" IS NULL` |
| Sesiones de bono dentro de rango, citas con fin > inicio | `CHECK` |

## 4. Flujos clave

### 4.1 Arrastrar y soltar una cita (`features/agenda`)

1. `AgendaBoard` (cliente, dnd-kit): cada peluquero es una columna *droppable*; cada cita PENDING/CONFIRMED es *draggable*. Mientras arrastras, `dragToStart()` convierte píxeles en minutos con *snap* de 15 min y se pinta una sombra con la hora destino.
2. Al soltar: actualización **optimista** del estado local.
3. `moveAppointment` (server action):
   - `pg_advisory_xact_lock(peluquero+día)` → serializa movimientos concurrentes al mismo peluquero/día.
   - Comprueba **versión** (bloqueo optimista) → si otra persona movió la cita, devuelve `STALE` y la UI recarga.
   - Comprueba **habilidades** (`StaffService`), **horario**, **bloqueos** y **solapes** con `findConflict()`.
   - Guarda, incrementa `version`, audita `MOVE` y notifica al cliente si cambió la hora.
4. Si el servidor rechaza, la UI **revierte** y muestra el motivo («La franja está bloqueada…»).

Las citas reservadas con «cualquiera» aparecen arriba en una bandeja «sin asignar» para arrastrarlas a una columna. Al crear una baja (`TimeBlock`) se devuelven las citas afectadas para reubicarlas con el mismo drag-and-drop.

### 4.2 Factura simplificada / completa (`features/billing`)

1. **Borrador** (`createDraftFromAppointment`): líneas desde la cita; las pagadas con bono van a 0 € con referencia a la sesión.
2. **Cálculo** (`calculateInvoice`, puro): precios con IVA incluido (PVP) → base = PVP / (1 + tipo); cuota calculada **por tipo de IVA sobre la base agregada**; retención IRPF sobre la base.
3. **Validación fiscal** (`validateInvoice`, pura; RD 1619/2012): NIF del emisor; ticket ≤ 400 € y sin IRPF; factura completa con NIF válido (DNI/NIE/CIF con dígito de control) y domicilio del destinatario; exentos con causa; negativos solo en rectificativas; rectificativa con referencia y motivo. La misma función se usa para mostrar avisos en el borrador.
4. **Emisión** (`issueInvoice`, una transacción): bloqueo de la cadena y de la serie (`FOR UPDATE`) → número correlativo **sin huecos** (si algo falla, rollback del contador) → huella SHA-256 encadenada con la anterior (formato Veri*Factu) → URL del QR de cotejo AEAT → `ISSUED`. Desde ese momento los triggers impiden cualquier cambio.
5. **Cobro** (`registerPayment`): append-only, sin sobrepagos; al completar el pago se suman puntos/sellos de fidelidad.
6. **Rectificación**: borrador `RECTIFYING` por diferencias (serie R); si anula el total, la original pasa a `VOIDED` (nunca se borra).
7. **PDF** (`/api/invoices/[id]/pdf`): pdf-lib (JS puro, compatible con Workers) con todos los datos obligatorios y el QR.

Series: `F` (completas), `T` (simplificadas), `R` (rectificativas), por año → `T2026-000001`.

### 4.3 Consumo de una sesión de bono (`features/vouchers`)

1. En caja, para cada servicio se listan **solo los bonos aplicables**, filtrados por `checkRedemption()` (titular, perro nominativo, caducidad a fecha de la cita, tamaño, servicio incluido, sesiones restantes).
2. `redeemVoucherSession` (transacción): vuelve a validar, incrementa `usedSessions` con **bloqueo optimista** (`where: { version }`), crea `VoucherRedemption`, pone la línea a 0 € y audita `CONSUME`. El estado pasa a `EXHAUSTED` al gastar la última sesión.
3. Reversión (cita cancelada): marca `reversedAt` (queda traza), devuelve la sesión y restaura el precio de tarifa; se bloquea si la sesión ya figura en una factura emitida.
4. Fiscalidad: el IVA del bono se devenga al **venderlo** (`sellVoucherAction` genera su factura); su consumo aparece en el ticket a 0 €.

## 5. Seguridad y cumplimiento

- Sesión JWT HS256 en cookie httpOnly (`lib/session.ts`, compatible con Edge); `requireRole()` en cada server action además del middleware. Sustituible por Auth.js sin tocar las features.
- Contraseñas con bcrypt (coste 12).
- RGPD: casillas **no pre-marcadas** y separadas por finalidad; cada consentimiento se guarda con versión de la política, IP y user-agent (`Consent`). Banner de cookies con «Rechazar» al mismo nivel que «Aceptar», configuración granular y registro probatorio (`CookieConsentLog`). Borrado lógico de usuario (`deletedAt`) para supresión/anonimización.
- Un cliente solo ve sus perros, citas y facturas (filtrado por `ownerId` de la sesión).
