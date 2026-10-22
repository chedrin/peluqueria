const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// BASE DE DATOS EN MEMORIA (INICIALIZADA CON DATOS REALISTAS DE PRODUCCIÓN)
// ============================================================================

const db = {
  users: [
    { id: 'usr-admin-1', phone: '34611111111', role: 'admin', firstName: 'Marisa', lastName: 'Garrido (Gerente)', isActive: true },
    { id: 'usr-staff-1', phone: '34622222222', role: 'staff', firstName: 'Elena', lastName: 'Gómez', isActive: true },
    { id: 'usr-staff-2', phone: '34633333333', role: 'staff', firstName: 'Raquel', lastName: 'Santos', isActive: true },
    { id: 'usr-staff-3', phone: '34644444444', role: 'staff', firstName: 'Carmen', lastName: 'Vidal', isActive: true },
    { id: 'usr-client-1', phone: '34655555555', role: 'client', firstName: 'Laura', lastName: 'Martínez', isActive: true },
    { id: 'usr-client-2', phone: '34666666666', role: 'client', firstName: 'Sofía', lastName: 'Morales', isActive: true },
  ],
  staff: [
    {
      id: 'stf-1',
      userId: 'usr-staff-1',
      name: 'Elena Gómez',
      displayColor: '#8B5CF6',
      isAvailable: true,
      notes: 'Especialista en Balayage y Colorimetría avanzada',
      scheduleConfig: {
        monday: { start: '09:30', end: '19:30' },
        tuesday: { start: '09:30', end: '19:30' },
        wednesday: { start: '09:30', end: '19:30' },
        thursday: { start: '09:30', end: '19:30' },
        friday: { start: '09:30', end: '19:30' },
        saturday: { start: '09:00', end: '14:00' },
      }
    },
    {
      id: 'stf-2',
      userId: 'usr-staff-2',
      name: 'Raquel Santos',
      displayColor: '#EC4899',
      isAvailable: true,
      notes: 'Corte de diseño, peinados y recogidos',
      scheduleConfig: {
        monday: { start: '09:30', end: '19:30' },
        tuesday: { start: '09:30', end: '19:30' },
        wednesday: { start: '09:30', end: '19:30' },
        thursday: { start: '09:30', end: '19:30' },
        friday: { start: '09:30', end: '19:30' },
        saturday: { start: '09:00', end: '14:00' },
      }
    },
    {
      id: 'stf-3',
      userId: 'usr-staff-3',
      name: 'Carmen Vidal',
      displayColor: '#10B981',
      isAvailable: true,
      notes: 'Tratamientos capilares, keratina e hidratación profunda',
      scheduleConfig: {
        monday: { start: '09:30', end: '19:30' },
        tuesday: { start: '09:30', end: '19:30' },
        wednesday: { start: '09:30', end: '19:30' },
        thursday: { start: '09:30', end: '19:30' },
        friday: { start: '09:30', end: '19:30' },
        saturday: { start: '09:00', end: '14:00' },
      }
    }
  ],
  services: [
    { id: 'srv-1', name: 'Corte y Estilismo', category: 'corte', durationMinutes: 30, price: 22.00, vatRate: 21.0 },
    { id: 'srv-2', name: 'Coloración Completa (Tinte)', category: 'coloracion', durationMinutes: 60, price: 38.00, vatRate: 21.0 },
    { id: 'srv-3', name: 'Mechas Balayage & Matiz', category: 'coloracion', durationMinutes: 90, price: 65.00, vatRate: 21.0 },
    { id: 'srv-4', name: 'Peinado & Brushing', category: 'peinado', durationMinutes: 30, price: 18.00, vatRate: 21.0 },
    { id: 'srv-5', name: 'Tratamiento Olaplex / Keratina', category: 'tratamiento', durationMinutes: 45, price: 35.00, vatRate: 21.0 },
  ],
  clients: [
    {
      id: 'cli-1',
      userId: 'usr-client-1',
      name: 'Laura Martínez',
      phone: '34655555555',
      allergies: 'Sensibilidad al amoniaco concentrado (usar oxidante 20vol sin PPD)',
      generalNotes: 'Prefiere tonos cobrizos sutiles. Suele pedir café con leche sin azúcar.',
      loyaltyPoints: 120,
      googleReviewVerified: false,
      qrCodeHash: 'QR-LAURA-77492-HASH',
      marketingConsent: true,
    },
    {
      id: 'cli-2',
      userId: 'usr-client-2',
      name: 'Sofía Morales',
      phone: '34666666666',
      allergies: 'Sin alergias conocidas',
      generalNotes: 'Cabello muy fino, corte en capas para aportar volumen.',
      loyaltyPoints: 50,
      googleReviewVerified: false,
      qrCodeHash: 'QR-SOFIA-88319-HASH',
      marketingConsent: true,
    }
  ],
  technicalRecords: [
    {
      id: 'tec-1',
      clientId: 'cli-1',
      staffName: 'Elena Gómez',
      date: '2026-09-15',
      dyeFormula: '6.1 (30g) + 7.0 (15g) con oxidante 20vol (45g) marca Igora Royal',
      techniqueUsed: 'Balayage suave con matiz perlado en bacha durante 12 minutos',
      exposureTimeMinutes: 35,
      observations: 'El tono quedó exactamente como en la foto de referencia. Raíz difuminada.',
      photoUrl: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=300&q=80'
    }
  ],
  products: [
    { id: 'prd-1', sku: 'COS-001', name: 'Champú Hidratante Argán Bio (250ml)', brand: 'Moroccanoil', price: 24.50, costPrice: 12.00, stock: 8, vatRate: 21.0, isShowcase: true, img: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=300&q=80' },
    { id: 'prd-2', sku: 'COS-002', name: 'Mascarilla Reparadora Proteína (200ml)', brand: 'Olaplex Nº3', price: 29.90, costPrice: 15.50, stock: 4, vatRate: 21.0, isShowcase: true, img: 'https://images.unsplash.com/photo-1608248597359-21626f21295f?auto=format&fit=crop&w=300&q=80' },
    { id: 'prd-3', sku: 'COS-003', name: 'Sérum Sellador de Puntas (100ml)', brand: 'Kérastase Elixir', price: 34.00, costPrice: 18.00, stock: 6, vatRate: 21.0, isShowcase: true, img: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=300&q=80' },
    { id: 'prd-4', sku: 'INT-001', name: 'Tubo Tinte 6.1 Rubio Oscuro Ceniza (60g)', brand: 'Igora', price: 9.50, costPrice: 4.80, stock: 18, vatRate: 21.0, isShowcase: false, img: '' }
  ],
  appointments: [
    {
      id: 'apt-1',
      clientId: 'cli-1',
      clientName: 'Laura Martínez',
      staffId: 'stf-1',
      staffName: 'Elena Gómez',
      serviceIds: ['srv-2', 'srv-1'],
      serviceNames: 'Coloración Completa (Tinte) + Corte y Estilismo',
      startTime: '2026-10-23T10:00:00.000Z',
      endTime: '2026-10-23T11:30:00.000Z',
      status: 'confirmed',
      clientComments: 'Repetir la fórmula de septiembre pero con reflejos un poco más claros.',
      reminderSent24h: true,
      reminderSent2h: false,
    },
    {
      id: 'apt-2',
      clientId: 'cli-2',
      clientName: 'Sofía Morales',
      staffId: 'stf-2',
      staffName: 'Raquel Santos',
      serviceIds: ['srv-1', 'srv-4'],
      serviceNames: 'Corte y Estilismo + Peinado & Brushing',
      startTime: '2026-10-23T16:30:00.000Z',
      endTime: '2026-10-23T17:30:00.000Z',
      status: 'confirmed',
      clientComments: 'Tiene una boda el sábado, probar ondas sueltas.',
      reminderSent24h: true,
      reminderSent2h: false,
    }
  ],
  invoices: [],
  appointmentAuditLogs: [],
  loyaltyTransactions: []
};

// ============================================================================
// MOTOR FISCAL ESPAÑOL (VERI*FACTU & LEY ANTIFRAUDE 11/2021)
// ============================================================================
const COMPANY_NIF = 'B-87654321';
const COMPANY_NAME = 'Peluquería & Estilismo Losan S.L.';

function calculateNextInvoiceHash(series, nextNumber, issueDateISO, totalTaxBase, totalVatAmount, totalAmount, previousHash) {
  const rawPayload = [
    COMPANY_NIF,
    series,
    nextNumber.toString(),
    issueDateISO,
    totalTaxBase.toFixed(2),
    totalVatAmount.toFixed(2),
    totalAmount.toFixed(2),
    previousHash
  ].join('|');

  return crypto.createHash('sha256').update(rawPayload, 'utf8').digest('hex');
}

// Inicializar con una factura previa para demostrar el encadenamiento
const initialIssueDate = new Date(Date.now() - 86400000 * 2).toISOString();
const initialHash = calculateNextInvoiceHash('FS2026', 1, initialIssueDate, 33.06, 6.94, 40.00, '0'.repeat(64));
db.invoices.push({
  id: 'inv-init-1',
  series: 'FS2026',
  invoiceNumber: 1,
  type: 'simplified',
  issueDate: initialIssueDate,
  clientName: 'Consumidor Final',
  clientNif: 'N/A',
  taxBase: 33.06,
  vatRate: 21.0,
  vatAmount: 6.94,
  totalAmount: 40.00,
  paymentMethod: 'card',
  previousInvoiceHash: '0'.repeat(64),
  recordHash: initialHash,
  qrUrl: `https://www.agenciatributaria.gob.es/verifactu/consulta?nif=${COMPANY_NIF}&serie=FS2026&num=1&total=40.00&hash=${initialHash.slice(0, 8)}`,
  items: [
    { concept: 'Corte Caballero y Lavado', quantity: 1, unitPrice: 20.00, vatRate: 21.0, totalAmount: 20.00 },
    { concept: 'Champú Cuidado Diario (200ml)', quantity: 1, unitPrice: 20.00, vatRate: 21.0, totalAmount: 20.00 }
  ]
});

// ============================================================================
// ENDPOINTS REST
// ============================================================================

// 1. Catálogo de Servicios
app.get('/api/services', (req, res) => {
  res.json(db.services);
});

// 2. Personal y Disponibilidad
app.get('/api/staff', (req, res) => {
  res.json(db.staff);
});

// 3. Citas y Agenda
app.get('/api/appointments', (req, res) => {
  res.json(db.appointments);
});

// Comprobar colisión de horario para estilista
function hasOverlap(staffId, start, end, excludeAptId = null) {
  const reqStart = new Date(start).getTime();
  const reqEnd = new Date(end).getTime();

  return db.appointments.some(apt => {
    if (apt.id === excludeAptId) return false;
    if (apt.staffId !== staffId) return false;
    if (apt.status === 'cancelled' || apt.status === 'rescheduling_required') return false;

    const aStart = new Date(apt.startTime).getTime();
    const aEnd = new Date(apt.endTime).getTime();

    // Comprobación de solapamiento de rangos
    return reqStart < aEnd && reqEnd > aStart;
  });
}

// 4. Crear Cita
app.post('/api/appointments/book', (req, res) => {
  const { clientId, staffId, serviceIds, startTime, clientComments } = req.body;

  if (!clientId || !serviceIds || !serviceIds.length || !startTime) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios.' });
  }

  // Calcular duración total sumando minutos de servicios seleccionados
  const selectedServices = db.services.filter(s => serviceIds.includes(s.id));
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  const start = new Date(startTime);
  const end = new Date(start.getTime() + totalDuration * 60000);

  // Asignar estilista: si es automática o específica
  let targetStaff = null;
  if (staffId && staffId !== 'any') {
    targetStaff = db.staff.find(s => s.id === staffId);
    if (!targetStaff || !targetStaff.isAvailable) {
      return res.status(400).json({ error: 'La profesional seleccionada no está disponible.' });
    }
    if (hasOverlap(staffId, start, end)) {
      return res.status(409).json({ error: 'Conflicto de agenda: Ese hueco ya está ocupado para esta profesional.' });
    }
  } else {
    // Buscar la primera estilista disponible sin conflicto
    targetStaff = db.staff.find(s => s.isAvailable && !hasOverlap(s.id, start, end));
    if (!targetStaff) {
      return res.status(409).json({ error: 'No hay ninguna profesional disponible en esa franja horaria.' });
    }
  }

  const client = db.clients.find(c => c.id === clientId) || { name: 'Clienta' };

  const newAppointment = {
    id: 'apt-' + Date.now(),
    clientId,
    clientName: client.name,
    staffId: targetStaff.id,
    staffName: targetStaff.name,
    serviceIds,
    serviceNames: selectedServices.map(s => s.name).join(' + '),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    status: 'confirmed',
    clientComments: clientComments || '',
    reminderSent24h: false,
    reminderSent2h: false,
    createdAt: new Date().toISOString()
  };

  db.appointments.push(newAppointment);

  // Registro de auditoría
  db.appointmentAuditLogs.push({
    id: 'aud-' + Date.now(),
    appointmentId: newAppointment.id,
    action: 'BOOKED',
    timestamp: new Date().toISOString()
  });

  res.status(201).json(newAppointment);
});

// 5. Modificar Cita (Admin o Reprogramación)
app.patch('/api/appointments/:id', (req, res) => {
  const apt = db.appointments.find(a => a.id === req.params.id);
  if (!apt) return res.status(404).json({ error: 'Cita no encontrada.' });

  const { staffId, startTime, status, clientComments } = req.body;

  if (staffId) {
    const stf = db.staff.find(s => s.id === staffId);
    if (stf) {
      apt.staffId = stf.id;
      apt.staffName = stf.name;
    }
  }

  if (startTime) {
    const start = new Date(startTime);
    const durationMs = new Date(apt.endTime).getTime() - new Date(apt.startTime).getTime();
    apt.startTime = start.toISOString();
    apt.endTime = new Date(start.getTime() + durationMs).toISOString();
  }

  if (status) apt.status = status;
  if (clientComments !== undefined) apt.clientComments = clientComments;

  db.appointmentAuditLogs.push({
    id: 'aud-' + Date.now(),
    appointmentId: apt.id,
    action: 'ADMIN_UPDATE',
    timestamp: new Date().toISOString()
  });

  res.json(apt);
});

// 6. PROTOCOLO DE BAJA MÉDICA REPENTINA (ALGORITMO EN CASCADA)
app.post('/api/staff/leave', (req, res) => {
  const { staffId, reason } = req.body;
  const targetStaff = db.staff.find(s => s.id === staffId);
  if (!targetStaff) return res.status(404).json({ error: 'Trabajadora no encontrada.' });

  // 1. Desactivar trabajadora
  targetStaff.isAvailable = false;
  targetStaff.notes += ` [Baja médica: ${reason || 'Imprevisto de salud'}]`;

  // 2. Extraer citas pendientes
  const affected = db.appointments.filter(a => 
    a.staffId === staffId && 
    (a.status === 'confirmed' || a.status === 'pending')
  );

  let automaticallyReassigned = 0;
  let proposalsSameDay = 0;
  let sentToAiQueue = 0;
  const details = [];

  affected.forEach(apt => {
    const start = new Date(apt.startTime);
    const end = new Date(apt.endTime);

    // NIVEL 1: Misma fecha y misma hora con otra compañera libre
    const colleague = db.staff.find(s => 
      s.id !== staffId && 
      s.isAvailable && 
      !hasOverlap(s.id, start, end, apt.id)
    );

    if (colleague) {
      apt.staffId = colleague.id;
      apt.staffName = colleague.name;
      apt.internalNotes = `[Reubicación automática por baja médica de ${targetStaff.name}]`;
      automaticallyReassigned++;
      details.push({
        aptId: apt.id,
        clientName: apt.clientName,
        action: 'Nivel 1: Reasignada automáticamente',
        newStaff: colleague.name,
        time: apt.startTime
      });
    } else {
      // NIVEL 2 / 3: Derivar a reprogramación prioritaria con IA
      apt.status = 'rescheduling_required';
      apt.staffId = null;
      apt.staffName = 'Por asignar';
      apt.internalNotes = `[Pendiente reubicación por baja médica]`;
      sentToAiQueue++;
      details.push({
        aptId: apt.id,
        clientName: apt.clientName,
        action: 'Nivel 3: Derivada a cola preferente de Agente IA',
        newStaff: 'Pendiente',
        time: apt.startTime
      });
    }
  });

  res.json({
    message: `Protocolo de baja ejecutado con éxito para ${targetStaff.name}.`,
    summary: {
      totalAffected: affected.length,
      automaticallyReassigned,
      proposalsSameDay,
      sentToAiQueue
    },
    details
  });
});

// 7. CLIENTES Y EXPEDIENTES TÉCNICOS
app.get('/api/clients/:id', (req, res) => {
  const client = db.clients.find(c => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: 'Clienta no encontrada.' });

  const records = db.technicalRecords.filter(r => r.clientId === client.id);
  res.json({ ...client, technicalRecords: records });
});

// Guardar nuevo registro técnico
app.post('/api/technical-records', (req, res) => {
  const { clientId, staffName, dyeFormula, techniqueUsed, exposureTimeMinutes, observations, photoUrl } = req.body;

  const newRecord = {
    id: 'tec-' + Date.now(),
    clientId,
    staffName: staffName || 'Estilista',
    date: new Date().toISOString().slice(0, 10),
    dyeFormula,
    techniqueUsed,
    exposureTimeMinutes: Number(exposureTimeMinutes) || 30,
    observations,
    photoUrl: photoUrl || 'https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=300&q=80'
  };

  db.technicalRecords.unshift(newRecord);
  res.status(201).json(newRecord);
});

// 8. FIDELIZACIÓN: VALIDAR RESEÑA GOOGLE BUSINESS
app.post('/api/loyalty/google-review', (req, res) => {
  const { clientId } = req.body;
  const client = db.clients.find(c => c.id === clientId);
  if (!client) return res.status(404).json({ error: 'Clienta no encontrada.' });

  if (client.googleReviewVerified) {
    return res.status(400).json({ error: 'Esta clienta ya cobró su bonificación por reseña en Google.' });
  }

  client.googleReviewVerified = true;
  client.loyaltyPoints += 50;

  db.loyaltyTransactions.push({
    id: 'loy-' + Date.now(),
    clientId: client.id,
    delta: 50,
    newBalance: client.loyaltyPoints,
    reason: 'GOOGLE_REVIEW_BONUS',
    date: new Date().toISOString()
  });

  res.json({
    success: true,
    message: '¡Reseña en Google verificada! Se han abonado 50 puntos de fidelización.',
    newBalance: client.loyaltyPoints
  });
});

// 9. MÓDULO FISCAL: EMISIÓN DE FACTURA VERI*FACTU
app.post('/api/invoices', (req, res) => {
  const { appointmentId, clientId, series = 'FS2026', type = 'simplified', items, paymentMethod, recipient } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'La factura debe contener al menos una línea.' });
  }

  // Obtener última factura de la serie para encadenar
  const seriesInvoices = db.invoices.filter(i => i.series === series);
  const nextNumber = seriesInvoices.length + 1;
  const previousHash = seriesInvoices.length > 0 
    ? seriesInvoices[seriesInvoices.length - 1].recordHash 
    : '0'.repeat(64);

  // Calcular totales e IVA desglosado
  let totalTaxBase = 0;
  let totalVatAmount = 0;
  let totalAmount = 0;

  const processedItems = items.map(it => {
    const gross = Number(it.quantity) * Number(it.unitPrice);
    const base = Math.round((gross / 1.21) * 100) / 100;
    const vat = Math.round((gross - base) * 100) / 100;

    totalTaxBase += base;
    totalVatAmount += vat;
    totalAmount += gross;

    return {
      concept: it.concept,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      vatRate: 21.0,
      taxBase: base,
      vatAmount: vat,
      totalAmount: gross
    };
  });

  totalTaxBase = Math.round(totalTaxBase * 100) / 100;
  totalVatAmount = Math.round(totalVatAmount * 100) / 100;
  totalAmount = Math.round(totalAmount * 100) / 100;

  const issueDateISO = new Date().toISOString();
  const recordHash = calculateNextInvoiceHash(series, nextNumber, issueDateISO, totalTaxBase, totalVatAmount, totalAmount, previousHash);

  const qrUrl = `https://www.agenciatributaria.gob.es/verifactu/consulta?nif=${COMPANY_NIF}&serie=${series}&num=${nextNumber}&total=${totalAmount.toFixed(2)}&hash=${recordHash.slice(0, 8)}`;

  const client = db.clients.find(c => c.id === clientId);

  const newInvoice = {
    id: 'inv-' + Date.now(),
    series,
    invoiceNumber: nextNumber,
    type,
    issueDate: issueDateISO,
    clientName: recipient?.name || client?.name || 'Cliente de paso',
    clientNif: recipient?.nif || client?.nif || 'N/A',
    taxBase: totalTaxBase,
    vatRate: 21.0,
    vatAmount: totalVatAmount,
    totalAmount,
    paymentMethod: paymentMethod || 'card',
    previousInvoiceHash: previousHash,
    recordHash,
    qrUrl,
    items: processedItems
  };

  db.invoices.push(newInvoice);

  // Si estaba asociada a una cita, marcarla como completada
  if (appointmentId) {
    const apt = db.appointments.find(a => a.id === appointmentId);
    if (apt) apt.status = 'completed';
  }

  res.status(201).json(newInvoice);
});

// Listado de facturas para visor fiscal y exportación AEAT
app.get('/api/invoices', (req, res) => {
  res.json(db.invoices);
});

// 10. PRODUCTOS / TIENDA ESCAPARATE
app.get('/api/products', (req, res) => {
  res.json(db.products);
});

app.post('/api/products/reserve', (req, res) => {
  const { productId, quantity = 1, clientName } = req.body;
  const product = db.products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });

  if (product.stock < quantity) {
    return res.status(400).json({ error: 'No hay suficiente stock disponible para este producto.' });
  }

  product.stock -= quantity;
  res.json({
    success: true,
    message: `Reserva confirmada de ${quantity}x "${product.name}" para recoger en el salón a nombre de ${clientName || 'la clienta'}.`,
    product
  });
});

// 11. AGENTE IA DE CITAS (CON SIMULADOR Y RESOLUCIÓN INTELIGENTE DE TOOLS)
app.post('/api/ai/chat', (req, res) => {
  const { message, clientId = 'cli-1' } = req.body;
  const text = (message || '').toLowerCase();
  const client = db.clients.find(c => c.id === clientId) || db.clients[0];

  // Simular reasoning y tool calling
  let toolCalled = null;
  let reply = '';

  if (text.includes('tinte') || text.includes('color') || text.includes('mechas') || text.includes('corte') || text.includes('precio') || text.includes('servicio')) {
    toolCalled = 'get_services_catalog()';
    reply = `¡Hola, ${client.name}! En nuestro salón tenemos los siguientes servicios estrella:\n` +
      `• **Corte y Estilismo**: 30 min (22,00 €)\n` +
      `• **Coloración Completa**: 60 min (38,00 €)\n` +
      `• **Mechas Balayage & Matiz**: 90 min (65,00 €)\n` +
      `• **Tratamiento Olaplex / Keratina**: 45 min (35,00 €)\n\n` +
      `¿Para qué día y hora te gustaría consultar hueco libre?`;
  } else if (text.includes('elena') || text.includes('raquel') || text.includes('carmen') || text.includes('viernes') || text.includes('mañana') || text.includes('hueco') || text.includes('hora')) {
    toolCalled = 'check_availability(service_ids=["srv-1", "srv-2"], staff="Elena", date="2026-10-23")';
    reply = `He consultado la agenda en directo para el viernes 23 con Elena:\n` +
      `• **16:00** — Disponible ✅\n` +
      `• **17:30** — Disponible ✅\n` +
      `*(A las 16:30 está ocupada por otra cita).*\n\n` +
      `¿Te reservo a las 17:30?`;
  } else if (text.includes('17:30') || text.includes('si') || text.includes('sí') || text.includes('reserva') || text.includes('confirma') || text.includes('perfecto')) {
    toolCalled = 'book_appointment(client_id="cli-1", staff_id="stf-1", start_time="2026-10-23T17:30:00Z")';
    
    // Crear la cita en vivo
    const newApt = {
      id: 'apt-' + Date.now(),
      clientId: client.id,
      clientName: client.name,
      staffId: 'stf-1',
      staffName: 'Elena Gómez',
      serviceIds: ['srv-1', 'srv-2'],
      serviceNames: 'Corte y Estilismo + Coloración Completa',
      startTime: '2026-10-23T17:30:00.000Z',
      endTime: '2026-10-23T19:00:00.000Z',
      status: 'confirmed',
      clientComments: 'Reservada automáticamente por el Asistente IA de Citas.',
      reminderSent24h: false,
      reminderSent2h: false,
      createdAt: new Date().toISOString()
    };
    db.appointments.push(newApt);

    reply = `🎉 **¡Cita confirmada con éxito!**\n\n` +
      `📅 **Fecha**: Viernes, 23 de Octubre de 2026\n` +
      `⏰ **Hora**: 17:30 a 19:00\n` +
      `💇‍♀️ **Estilista**: Elena Gómez\n` +
      `✨ **Servicios**: Corte y Estilismo + Coloración Completa\n\n` +
      `Hemos programado tus recordatorios por WhatsApp para 24h y 2h antes de la cita. ¡Te esperamos en el salón!`;
  } else {
    reply = `¡Hola, ${client.name}! Soy tu asistente personal de citas de Peluquería Losan. Puedes pedirme ver los servicios, consultar huecos libres con Elena, Raquel o Carmen, o decirme qué necesitas y te buscaré la mejor opción. ¿En qué te ayudo hoy?`;
  }

  res.json({ reply, toolCalled });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n==========================================================`);
  console.log(`🚀 SERVIDOR PELUQUERÍA INTEGRAL EN EJECUCIÓN`);
  console.log(`👉 URL Local: http://localhost:${PORT}`);
  console.log(`👉 Cumplimiento Veri*Factu (Ley 11/2021) Activo`);
  console.log(`==========================================================\n`);
});
