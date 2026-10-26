# 💇‍♀️ Peluquería & Estilismo — Plataforma Integral de Gestión

> 🐶 **Nuevo:** el CRM de **Peluquería y Estética Canina** (Next.js + Prisma + PostgreSQL) vive en [`canina/`](canina/README.md) y se arranca en el puerto 3025.

> Aplicación web integral para la gestión de salones de peluquería y belleza, con control de acceso basado en roles (**RBAC**), agente de citas con **IA conversacional & Tool Calling**, protocolo de **contingencia por baja médica**, y motor de **facturación inalterable Veri*Factu** conforme a la **Ley Antifraude Española 11/2021** y **RD 1007/2023**.

---

## 🌟 Portales y Módulos Principales

### 1. 📱 Portal Clientas (PWA / Mobile-First)
- **Agente IA de Citas**: Chat conversacional con análisis de intención, consulta de huecos en tiempo real y ejecución de herramientas de reserva (*Tool Calling*).
- **Calendario Interactivo**: Visualización clara de huecos libres y ocupados por estilista y franja horaria.
- **Fidelización QR & Reseñas Google**: Generación de código QR único por clienta, saldo de puntos y validación automatizada de reseñas en Google Business (+50 pts).
- **Tienda Escaparate**: Catálogo de cosméticos de muestra con stock visible y reserva directa para recogida en salón.
- **Avisos Automatizados**: Simulación interactiva de notificaciones de WhatsApp (24h y 2h antes).

### 2. ✂️ Portal Trabajadoras
- **Agenda Diaria/Semanal Individual**: Filtro dinámico por estilista asignada (Elena Gómez, Raquel Santos, Carmen Vidal).
- **Ficha Técnica Previa**: Historial de colorimetría (fórmulas de tinte, mezclas, marcas, gramajes), alergias y cortes previos.
- **Actualización Post-Servicio**: Formulario rápido para añadir la nueva fórmula aplicada, técnica, tiempo de exposición y notas de resultado.

### 3. 📊 Panel de Administración & Gerencia
- **Agenda Maestra Multicanal**: Visualización simultánea por sillones/profesionales con control de solapamiento.
- **Protocolo de Baja Médica Repentina**: Algoritmo en cascada en 3 niveles que reubica citas automáticamente con compañeras libres o deriva al agente IA con trato preferente.
- **Módulo TPV & Cobros**: Liquidación en caja, métodos de pago múltiples (tarjeta, efectivo, Bizum, puntos) y aplicación de descuentos.
- **Módulo Fiscal Español (Veri*Factu / Ley 11/2021)**:
  - Series correlativas sin saltos (`FS2026-XXXX`).
  - Desglose legal de base imponible y 21% de IVA.
  - Encadenamiento inalterable mediante hash criptográfico **SHA-256** ($Hash_N = \text{SHA256}(\dots \parallel Hash_{N-1})$).
  - Generación de código **QR oficial de cotejo en la Sede Electrónica de la AEAT**.
  - Exportación del Libro Registro de Facturas Emitidas para la asesoría fiscal (Modelos 303 y 130).
- **Control de Stock**: Inventario de uso interno y escaparate con alertas de reposición.

---

## 🚀 Puesta en Marcha

### Requisitos Previos
- Node.js (v18+)

### Ejecución con Servidor Local (Express + API REST)
```bash
# 1. Navegar al directorio del proyecto
cd "C:\Users\chedrin\.gemini\antigravity\scratch\peluqueria-app"

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor
npm start
```
Abre tu navegador en: **`http://localhost:3000`**

### Ejecución Directa Standalone
También puedes abrir directamente el archivo `public/index.html` en cualquier navegador web moderno (Google Chrome, Microsoft Edge, Firefox, Safari).

---

## 📂 Estructura del Proyecto

```
peluqueria-app/
├── package.json          # Metadatos y scripts
├── server.js             # API REST, motor fiscal SHA-256, simulador de IA y endpoints
├── public/
│   └── index.html        # SPA moderna con Tailwind CSS, Lucide Icons, QRious y RBAC
└── README.md             # Documentación del sistema
```
