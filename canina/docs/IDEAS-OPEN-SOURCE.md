# Ideas tomadas de proyectos open source (>1000 ★)

No hay CRMs de peluquería canina open source con más de 1000 estrellas, así que se han estudiado los proyectos de referencia de cada pieza: reservas, agenda, facturación y CRM.

| Proyecto | Estrellas | Qué hemos tomado |
|---|---|---|
| [Cal.com](https://github.com/calcom/cal.com) | ~49 k | Motor de disponibilidad como *resta de intervalos* (horario − ocupado − bloqueos) y troceado por granularidad; re-comprobar el hueco **dentro de la transacción** al reservar para evitar dobles reservas; política de cancelación/reprogramación con antelación mínima. |
| [Easy!Appointments](https://github.com/alextselegidis/easyappointments) | ~4,5 k | Modelo *proveedor ↔ servicio* (`StaffService`), «plan de trabajo» semanal con turnos partidos (`WorkingHours`) y descansos/excepciones como entidades (`TimeBlock`); opción «cualquier proveedor» con reparto de carga. |
| [Rallly](https://github.com/lukevella/rallly) | ~5,3 k | Next.js + Prisma + Tailwind en monorepo; patrón de *server actions* con validación Zod y errores tipados. |
| [FullCalendar](https://github.com/fullcalendar/fullcalendar) | ~20,7 k | UX de la vista por recursos (una columna por profesional, eje vertical horario, *snap* a 15 min, sombra de destino, revertir si el servidor rechaza). **No se usa la librería**: las vistas de recursos con drag-and-drop son *premium* (licencia de pago para uso comercial), por eso la agenda está hecha con **dnd-kit** (MIT). |
| [Invoify](https://github.com/al1abb/invoify) | ~6,3 k | Generador de facturas con Next.js + TypeScript + shadcn/ui: separación cálculo/plantilla y generación de PDF en servidor. |
| [Invoice Ninja](https://github.com/invoiceninja/invoiceninja) | miles | Ciclo de vida *borrador → emitida → cobrada/anulada*, cobros parciales como registros independientes y rectificación en lugar de edición. |
| [Twenty](https://github.com/twentyhq/twenty) | ~44 k | Organización por dominios/feature-modules, ficha 360º del cliente (datos, relaciones, historial, consentimientos) y auditoría de cambios. |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | >100 k | Componentes copiados en `src/components/ui` con tokens CSS (tema claro y personalizable). |

Además, la app anterior de este mismo repositorio (peluquería humana, raíz del repo) ya tenía un encadenamiento SHA-256 tipo Veri*Factu; aquí se ha rehecho siguiendo el formato de campos de la especificación de la AEAT y se ha reforzado con triggers en PostgreSQL.

Fuentes de las cifras de estrellas: [OpenAlternative · Appointment scheduling](https://openalternative.co/categories/business-software/scheduling-event-management/appointment-scheduling) (Cal.com, Rallly, Easy!Appointments), [Best of JS · FullCalendar](https://bestofjs.org/projects/fullcalendar), [OSS Insight · Invoify](https://ossinsight.io/analyze/al1abb/invoify), [artículo sobre Twenty CRM](https://pasqualepillitteri.it/de/news/957/twenty-crm-open-source-alternative-salesforce-hubspot-de). Las cifras de Invoice Ninja y shadcn/ui son aproximadas.
