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
      specialty: 'Colorimetría & Balayage',
      chair: 'Sillón 1 (Color)',
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
      specialty: 'Cortes & Estilismo',
      chair: 'Sillón 2 (Cortes)',
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
      specialty: 'Tratamientos & Salud Capilar',
      chair: 'Sillón 3 (Tratamientos)',
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
      dni: '12345678Z',
      userId: 'usr-client-1',
      name: 'Laura Martínez',
      phone: '34655555555',
      allergies: 'Sensibilidad al amoniaco concentrado (usar oxidante 20vol sin PPD)',
      generalNotes: 'Prefiere tonos cobrizos sutiles. Suele pedir café con leche sin azúcar.',
      loyaltyPoints: 120,
      googleReviewVerified: false,
      qrCodeHash: 'QR-12345678Z-77492-HASH',
      marketingConsent: true,
    },
    {
      id: 'cli-2',
      dni: '87654321X',
      userId: 'usr-client-2',
      name: 'Sofía Morales',
      phone: '34666666666',
      allergies: 'Sin alergias conocidas. Cabello muy fino.',
      generalNotes: 'Cabello muy fino, corte en capas para aportar volumen. Cuero cabelludo normal.',
      loyaltyPoints: 50,
      googleReviewVerified: false,
      qrCodeHash: 'QR-87654321X-88319-HASH',
      marketingConsent: true,
    },
    {
      id: 'cli-3',
      dni: '45678912C',
      name: 'Carmen Sánchez',
      phone: '34677777777',
      allergies: 'Alergia al níquel (cuidado con tijeras/utensilios metálicos directos en cuero cabelludo)',
      generalNotes: 'Prefiere cortes despuntados y flequillo cortina.',
      loyaltyPoints: 75,
      googleReviewVerified: true,
      qrCodeHash: 'QR-45678912C-99214-HASH',
      marketingConsent: true
    },
    {
      id: 'cli-4',
      dni: '78912345M',
      name: 'Marta Domínguez',
      phone: '34688888888',
      allergies: 'Cuero cabelludo reactivo. Emplear champú calmante dermo-protector.',
      generalNotes: 'Pelo castaño con tendencia a oxidar a tonos anaranjados. Usar matiz violeta.',
      loyaltyPoints: 90,
      googleReviewVerified: false,
      qrCodeHash: 'QR-78912345M-11234-HASH',
      marketingConsent: true
    },
    {
      id: 'cli-5',
      dni: '32165498B',
      name: 'Beatriz Navarro',
      phone: '34699999999',
      allergies: 'Sin alergias conocidas',
      generalNotes: 'Le encanta el corte Bob simétrico bien pulido con plancha.',
      loyaltyPoints: 40,
      googleReviewVerified: false,
      qrCodeHash: 'QR-32165498B-33421-HASH',
      marketingConsent: true
    },
    {
      id: 'cli-6',
      dni: '65498732L',
      name: 'Lucía Pardo',
      phone: '34600112233',
      allergies: 'Sin alergias',
      generalNotes: 'Clienta de peinados y brushing semanal.',
      loyaltyPoints: 110,
      googleReviewVerified: false,
      qrCodeHash: 'QR-65498732L-55612-HASH',
      marketingConsent: true
    },
    {
      id: 'cli-7',
      dni: '98732165S',
      name: 'Clara Sanz',
      phone: '34622334455',
      allergies: 'Decoloraciones previas caseras. Cabello castigado y quebradizo en puntas.',
      generalNotes: 'Tratamiento Olaplex en cada visita. Prohibido decolorar puntas.',
      loyaltyPoints: 160,
      googleReviewVerified: true,
      qrCodeHash: 'QR-98732165S-88712-HASH',
      marketingConsent: true
    },
    {
      id: 'cli-8',
      dni: '15975346A',
      name: 'Andrea Gil',
      phone: '34633445566',
      allergies: 'Sin alergias conocidas',
      generalNotes: 'Tinte 5.0 castaño natural para cobertura 100% canas.',
      loyaltyPoints: 65,
      googleReviewVerified: false,
      qrCodeHash: 'QR-15975346A-44512-HASH',
      marketingConsent: true
    },
    {
      id: 'cli-9',
      dni: '75315948P',
      name: 'Paula Ruiz',
      phone: '34644556677',
      allergies: 'Sin alergias',
      generalNotes: 'Mantenimiento de puntas y corte recto regular.',
      loyaltyPoints: 30,
      googleReviewVerified: false,
      qrCodeHash: 'QR-75315948P-66781-HASH',
      marketingConsent: true
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
    },
    {
      id: 'tec-2',
      clientId: 'cli-2',
      staffName: 'Raquel Santos',
      date: '2026-09-28',
      dyeFormula: 'No aplicó coloración química (solo corte y peinado)',
      techniqueUsed: 'Corte Bob en capas invisibles para volumen, peinado con ondas al agua',
      exposureTimeMinutes: 0,
      observations: 'Cabello muy agradecido, responde bien al sérum de keratina en medios a puntas.',
      photoUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=300&q=80'
    },
    {
      id: 'tec-3',
      clientId: 'cli-3',
      staffName: 'Elena Gómez',
      date: '2026-10-02',
      dyeFormula: 'Reflejos 7.3 dorado con oxidante 10vol (30g)',
      techniqueUsed: 'Mechas finas en corona y contorno facial',
      exposureTimeMinutes: 20,
      observations: 'Evitar contacto metálico por alergia al níquel. Uso de peines de carbono.',
      photoUrl: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=300&q=80'
    },
    {
      id: 'tec-4',
      clientId: 'cli-4',
      staffName: 'Elena Gómez',
      date: '2026-08-20',
      dyeFormula: 'Blondme sin amoniaco + oxidante 20vol con matizador T-Ice',
      techniqueUsed: 'Balayage a mano alzada',
      exposureTimeMinutes: 40,
      observations: 'Aclaró a nivel 9 limpio. Matizado perfecto sin reflejos amarillentos.',
      photoUrl: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=300&q=80'
    },
    {
      id: 'tec-5',
      clientId: 'cli-5',
      staffName: 'Raquel Santos',
      date: '2026-10-10',
      dyeFormula: 'No aplicó coloración',
      techniqueUsed: 'Corte a navaja en nuca y tijera dentada en laterales',
      exposureTimeMinutes: 0,
      observations: 'Le encanta el acabado liso pulido con aceite de argán.',
      photoUrl: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=300&q=80'
    },
    {
      id: 'tec-6',
      clientId: 'cli-7',
      staffName: 'Carmen Vidal',
      date: '2026-10-05',
      dyeFormula: 'Tratamiento Olaplex Nº1 Bond Multiplier (15ml) + Nº2 Bond Perfector (30ml)',
      techniqueUsed: 'Reconstrucción molecular capilar con campana de vapor ozonizado',
      exposureTimeMinutes: 30,
      observations: 'Recuperó un 80% de elasticidad en puntas. Continuar con mascarilla en casa.',
      photoUrl: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=300&q=80'
    }
  ],
  products: [
    { id: 'prd-1', sku: 'COS-001', name: 'Champú Hidratante Argán Bio (250ml)', brand: 'Moroccanoil', price: 24.50, costPrice: 12.00, stock: 8, vatRate: 21.0, isShowcase: true, img: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=300&q=80' },
    { id: 'prd-2', sku: 'COS-002', name: 'Mascarilla Reparadora Proteína (200ml)', brand: 'Olaplex Nº3', price: 29.90, costPrice: 15.50, stock: 4, vatRate: 21.0, isShowcase: true, img: 'https://images.unsplash.com/photo-1608248597359-21626f21295f?auto=format&fit=crop&w=300&q=80' },
    { id: 'prd-3', sku: 'COS-003', name: 'Sérum Sellador de Puntas (100ml)', brand: 'Kérastase Elixir', price: 34.00, costPrice: 18.00, stock: 6, vatRate: 21.0, isShowcase: true, img: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=300&q=80' },
    { id: 'prd-4', sku: 'INT-001', name: 'Tubo Tinte 6.1 Rubio Oscuro Ceniza (60g)', brand: 'Igora', price: 9.50, costPrice: 4.80, stock: 18, vatRate: 21.0, isShowcase: false, img: '' }
  ],
  // CITAS REALISTAS Y DIFERENTES PARA CADA ESTILISTA
  appointments: [
    // ------------------------------------------------------------------------
    // AGENDA ELENA GÓMEZ (stf-1 - Colorimetría & Balayage)
    // ------------------------------------------------------------------------
    {
      id: 'apt-elena-1',
      clientId: 'cli-1',
      clientDni: '12345678Z',
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
      id: 'apt-elena-2',
      clientId: 'cli-3',
      clientDni: '45678912C',
      clientName: 'Carmen Sánchez',
      staffId: 'stf-1',
      staffName: 'Elena Gómez',
      serviceIds: ['srv-1'],
      serviceNames: 'Corte y Estilismo',
      startTime: '2026-10-23T12:00:00.000Z',
      endTime: '2026-10-23T12:30:00.000Z',
      status: 'confirmed',
      clientComments: 'Corte y desfilado de flequillo cortina.',
      reminderSent24h: true,
      reminderSent2h: false,
    },
    {
      id: 'apt-elena-3',
      clientId: 'cli-4',
      clientDni: '78912345M',
      clientName: 'Marta Domínguez',
      staffId: 'stf-1',
      staffName: 'Elena Gómez',
      serviceIds: ['srv-3'],
      serviceNames: 'Mechas Balayage & Matiz',
      startTime: '2026-10-23T16:00:00.000Z',
      endTime: '2026-10-23T17:30:00.000Z',
      status: 'confirmed',
      clientComments: 'Balayage rubio ceniza, matiz frío anti-reflejos dorados.',
      reminderSent24h: false,
      reminderSent2h: false,
    },

    // ------------------------------------------------------------------------
    // AGENDA RAQUEL SANTOS (stf-2 - Cortes & Peinados)
    // ------------------------------------------------------------------------
    {
      id: 'apt-raquel-1',
      clientId: 'cli-5',
      clientDni: '32165498B',
      clientName: 'Beatriz Navarro',
      staffId: 'stf-2',
      staffName: 'Raquel Santos',
      serviceIds: ['srv-1'],
      serviceNames: 'Corte y Estilismo (Bob Simétrico)',
      startTime: '2026-10-23T10:30:00.000Z',
      endTime: '2026-10-23T11:15:00.000Z',
      status: 'confirmed',
      clientComments: 'Repasar corte Bob y peinado liso.',
      reminderSent24h: true,
      reminderSent2h: false,
    },
    {
      id: 'apt-raquel-2',
      clientId: 'cli-2',
      clientDni: '87654321X',
      clientName: 'Sofía Morales',
      staffId: 'stf-2',
      staffName: 'Raquel Santos',
      serviceIds: ['srv-1', 'srv-4'],
      serviceNames: 'Corte y Estilismo + Peinado & Brushing',
      startTime: '2026-10-23T16:30:00.000Z',
      endTime: '2026-10-23T17:30:00.000Z',
      status: 'confirmed',
      clientComments: 'Tiene una boda el sábado, probar ondas sueltas con tenacilla.',
      reminderSent24h: true,
      reminderSent2h: false,
    },
    {
      id: 'apt-raquel-3',
      clientId: 'cli-6',
      clientDni: '65498732L',
      clientName: 'Lucía Pardo',
      staffId: 'stf-2',
      staffName: 'Raquel Santos',
      serviceIds: ['srv-4'],
      serviceNames: 'Peinado & Brushing',
      startTime: '2026-10-23T18:00:00.000Z',
      endTime: '2026-10-23T18:30:00.000Z',
      status: 'confirmed',
      clientComments: 'Peinado exprés antes de una cena.',
      reminderSent24h: false,
      reminderSent2h: false,
    },

    // ------------------------------------------------------------------------
    // AGENDA CARMEN VIDAL (stf-3 - Tratamientos Capilares)
    // ------------------------------------------------------------------------
    {
      id: 'apt-carmen-1',
      clientId: 'cli-7',
      clientDni: '98732165S',
      clientName: 'Clara Sanz',
      staffId: 'stf-3',
      staffName: 'Carmen Vidal',
      serviceIds: ['srv-5'],
      serviceNames: 'Tratamiento Olaplex / Keratina',
      startTime: '2026-10-23T09:30:00.000Z',
      endTime: '2026-10-23T10:30:00.000Z',
      status: 'confirmed',
      clientComments: 'Sesión mensual de nutrición profunda bajo vapor ozonizado.',
      reminderSent24h: true,
      reminderSent2h: false,
    },
    {
      id: 'apt-carmen-2',
      clientId: 'cli-8',
      clientDni: '15975346A',
      clientName: 'Andrea Gil',
      staffId: 'stf-3',
      staffName: 'Carmen Vidal',
      serviceIds: ['srv-2', 'srv-5'],
      serviceNames: 'Coloración Completa + Tratamiento Olaplex',
      startTime: '2026-10-23T12:30:00.000Z',
      endTime: '2026-10-23T14:00:00.000Z',
      status: 'confirmed',
      clientComments: 'Tinte 5.0 castaño natural y protección de brillo.',
      reminderSent24h: true,
      reminderSent2h: false,
    },
    {
      id: 'apt-carmen-3',
      clientId: 'cli-9',
      clientDni: '75315948P',
      clientName: 'Paula Ruiz',
      staffId: 'stf-3',
      staffName: 'Carmen Vidal',
      serviceIds: ['srv-1'],
      serviceNames: 'Corte y Estilismo',
      startTime: '2026-10-23T17:00:00.000Z',
      endTime: '2026-10-23T17:30:00.000Z',
      status: 'confirmed',
      clientComments: 'Mantenimiento de puntas.',
      reminderSent24h: false,
      reminderSent2h: false,
    }
  ],
  invoices: [],
  appointmentAuditLogs: [],
  loyaltyTransactions: [],

  // --------------------------------------------------------------------------
  // BONOS DE SESIONES Y PACKS DE SERVICIOS
  // --------------------------------------------------------------------------
  packages: [
    {
      id: 'pkg-1',
      name: 'Bono 5 Sesiones Peinado & Brushing (1 Gratis)',
      category: 'peinado',
      description: 'Ideal para clientas de peinado semanal. Pagas 4 y disfrutas 5 sesiones con lavado e hidratación exprés incluidos.',
      totalSessions: 5,
      price: 72.00,
      regularPrice: 90.00,
      discountPercent: 20,
      validDays: 180,
      includedServices: ['Peinado & Brushing', 'Lavado Dermo-Protector']
    },
    {
      id: 'pkg-2',
      name: 'Pack Luxury Balayage & Reconstrucción Total',
      category: 'coloracion',
      description: 'Balayage a mano alzada + Matiz perlado o vainilla + Tratamiento Olaplex Nº1 y Nº2 + Corte de diseño.',
      totalSessions: 1,
      price: 98.00,
      regularPrice: 122.00,
      discountPercent: 20,
      validDays: 90,
      includedServices: ['Mechas Balayage & Matiz', 'Tratamiento Olaplex Reconstructor', 'Corte y Estilismo']
    },
    {
      id: 'pkg-3',
      name: 'Bono 4 Sesiones Tratamiento Molecular Keratina',
      category: 'tratamiento',
      description: 'Tratamiento mensual continuo para recuperar cabellos castigados o decolorados.',
      totalSessions: 4,
      price: 110.00,
      regularPrice: 140.00,
      discountPercent: 21,
      validDays: 365,
      includedServices: ['Tratamiento Olaplex / Keratina', 'Campana Vapor Ozonizado']
    }
  ],

  // Bonos adquiridos por clientas
  clientPackages: [
    {
      id: 'cpkg-1',
      packageId: 'pkg-1',
      packageName: 'Bono 5 Sesiones Peinado & Brushing (1 Gratis)',
      clientId: 'cli-1',
      clientDni: '12345678Z',
      clientName: 'Laura Martínez',
      totalSessions: 5,
      usedSessions: 2,
      remainingSessions: 3,
      purchaseDate: '2026-09-10',
      expiresAt: '2027-03-10',
      status: 'active'
    },
    {
      id: 'cpkg-2',
      packageId: 'pkg-3',
      packageName: 'Bono 4 Sesiones Tratamiento Molecular Keratina',
      clientId: 'cli-7',
      clientDni: '98732165S',
      clientName: 'Clara Sanz',
      totalSessions: 4,
      usedSessions: 1,
      remainingSessions: 3,
      purchaseDate: '2026-10-02',
      expiresAt: '2027-10-02',
      status: 'active'
    }
  ],

  // --------------------------------------------------------------------------
  // TARJETAS REGALO DIGITALES (GIFT CARDS / VOUCHERS)
  // --------------------------------------------------------------------------
  giftCards: [
    {
      id: 'gc-1',
      code: 'REGALO-50-LOSAN',
      initialBalance: 50.00,
      remainingBalance: 50.00,
      buyerName: 'Carlos Gómez',
      buyerEmail: 'carlos@example.com',
      recipientName: 'Laura Martínez',
      recipientDni: '12345678Z',
      message: '¡Feliz cumpleaños Laura! Disfruta de una tarde de relax en Losan.',
      createdAt: '2026-10-15T12:00:00.000Z',
      expiresAt: '2027-10-15',
      status: 'active'
    },
    {
      id: 'gc-2',
      code: 'VIP-100-LOSAN',
      initialBalance: 100.00,
      remainingBalance: 75.00,
      buyerName: 'Javier Sanz',
      buyerEmail: 'javier@example.com',
      recipientName: 'Clara Sanz',
      recipientDni: '98732165S',
      message: 'Para tus sesiones de tratamiento capilar con Carmen.',
      createdAt: '2026-10-01T10:00:00.000Z',
      expiresAt: '2027-10-01',
      status: 'active'
    }
  ],

  // --------------------------------------------------------------------------
  // TESTS DE DIAGNÓSTICO CAPILAR DIGITAL (CONSULTATION FORMS)
  // --------------------------------------------------------------------------
  consultations: [
    {
      id: 'con-1',
      clientId: 'cli-1',
      clientDni: '12345678Z',
      clientName: 'Laura Martínez',
      hairType: 'Ondulado, grosor medio',
      scalpCondition: 'Sensible / tendencia reactiva',
      chemicalHistory: 'Decoloración balayage previa hace 4 meses',
      washFrequency: 'Cada 2-3 días',
      mainGoal: 'Aclarar contorno facial (Money Piece) y mantener brillo sin resecar',
      allergiesConfirmed: 'Sensibilidad al amoniaco concentrado (usar oxidante 20vol sin PPD)',
      patchTestVerified: true,
      updatedAt: '2026-10-01T11:00:00.000Z'
    },
    {
      id: 'con-2',
      clientId: 'cli-7',
      clientDni: '98732165S',
      clientName: 'Clara Sanz',
      hairType: 'Fino, porosidad alta, muy quebradizo en puntas',
      scalpCondition: 'Normal',
      chemicalHistory: 'Decoloración casera agresiva en agosto 2026',
      washFrequency: 'Diario',
      mainGoal: 'Reconstrucción molecular de puentes de disulfuro (Olaplex), frenar rotura',
      allergiesConfirmed: 'Sin alergias conocidas',
      patchTestVerified: true,
      updatedAt: '2026-10-05T09:30:00.000Z'
    }
  ],

  // --------------------------------------------------------------------------
  // LOOKBOOK: GALERÍA DE TRANSFORMACIONES "ANTES Y DESPUÉS"
  // --------------------------------------------------------------------------
  galleryLooks: [
    {
      id: 'look-1',
      title: 'Balayage Rubio Perla & Face Framing',
      category: 'Coloración',
      stylistId: 'stf-1',
      stylistName: 'Elena Gómez',
      beforeImg: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=500&q=80',
      afterImg: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=500&q=80',
      description: 'Transición de base castaña natural a rubio luminoso mediante micro-mechas a mano alzada y matizado frío.',
      formulaSummary: 'Igora 9.5-1 (30g) + 20vol (30g) con Olaplex Nº1',
      durationMinutes: 120,
      priceEstimate: 85.00,
      serviceIds: ['srv-3', 'srv-5']
    },
    {
      id: 'look-2',
      title: 'Corte French Bob Desfilado & Peinado Wet',
      category: 'Corte & Estilismo',
      stylistId: 'stf-2',
      stylistName: 'Raquel Santos',
      beforeImg: 'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?auto=format&fit=crop&w=500&q=80',
      afterImg: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=500&q=80',
      description: 'Corte Bob texturizado a la altura de la mandíbula que aporta volumen natural y movimiento.',
      formulaSummary: 'Corte navaja feather + Sérum Kérastase Elixir',
      durationMinutes: 45,
      priceEstimate: 40.00,
      serviceIds: ['srv-1', 'srv-4']
    },
    {
      id: 'look-3',
      title: 'Reconstrucción Capilar Shock Térmico',
      category: 'Tratamiento',
      stylistId: 'stf-3',
      stylistName: 'Carmen Vidal',
      beforeImg: 'https://images.unsplash.com/photo-1522337094346-29177f374716?auto=format&fit=crop&w=500&q=80',
      afterImg: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=500&q=80',
      description: 'Tratamiento intensivo con campana de ozono y concentrado de ceramidas para sellar puntas abiertas.',
      formulaSummary: 'Olaplex Nº1 (15ml) + Infusión Ácido Hialurónico',
      durationMinutes: 60,
      priceEstimate: 55.00,
      serviceIds: ['srv-5']
    }
  ],

  // --------------------------------------------------------------------------
  // PROPINAS Y REGISTRO DE RENDIMIENTO
  // --------------------------------------------------------------------------
  staffTips: [
    { id: 'tip-1', staffId: 'stf-1', amount: 5.00, paymentMethod: 'bizum', clientName: 'Laura Martínez', date: '2026-10-21' },
    { id: 'tip-2', staffId: 'stf-2', amount: 3.50, paymentMethod: 'card', clientName: 'Sofía Morales', date: '2026-10-22' },
    { id: 'tip-3', staffId: 'stf-3', amount: 6.00, paymentMethod: 'cash', clientName: 'Clara Sanz', date: '2026-10-22' }
  ]
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
  const { clientId, clientDni, staffId, serviceIds, startTime, clientComments } = req.body;

  if ((!clientId && !clientDni) || !serviceIds || !serviceIds.length || !startTime) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios.' });
  }

  const selectedServices = db.services.filter(s => serviceIds.includes(s.id));
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  const start = new Date(startTime);
  const end = new Date(start.getTime() + totalDuration * 60000);

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
    targetStaff = db.staff.find(s => s.isAvailable && !hasOverlap(s.id, start, end));
    if (!targetStaff) {
      return res.status(409).json({ error: 'No hay ninguna profesional disponible en esa franja horaria.' });
    }
  }

  let client = null;
  if (clientDni) {
    const cleanDni = clientDni.trim().toUpperCase().replace(/[\s-]/g, '');
    client = db.clients.find(c => c.dni && c.dni.toUpperCase() === cleanDni);
  }
  if (!client && clientId) {
    client = db.clients.find(c => c.id === clientId);
  }
  if (!client) {
    client = { id: clientId || 'cli-anon', name: 'Clienta', dni: clientDni || '' };
  }

  const newAppointment = {
    id: 'apt-' + Date.now(),
    clientId: client.id,
    clientDni: client.dni || '',
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

  targetStaff.isAvailable = false;
  targetStaff.notes += ` [Baja médica: ${reason || 'Imprevisto de salud'}]`;

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

// 7. CLIENTES Y EXPEDIENTES TÉCNICOS (DNI COMO IDENTIFICADOR FUNDAMENTAL)
app.get('/api/clients', (req, res) => {
  res.json(db.clients);
});

// Autenticación / Acceso / Registro de clientas por DNI (ID Fundamental)
app.post('/api/clients/auth', (req, res) => {
  const { dni, name, phone, allergies, generalNotes } = req.body;
  if (!dni || !dni.trim()) {
    return res.status(400).json({ error: 'El DNI o NIE es obligatorio para acceder.' });
  }

  const cleanDni = dni.trim().toUpperCase().replace(/[\s-]/g, '');
  let client = db.clients.find(c => c.dni && c.dni.toUpperCase() === cleanDni);

  if (client) {
    // Si viene información adicional para actualizar en base de datos
    if (name && name.trim()) client.name = name.trim();
    if (phone && phone.trim()) client.phone = phone.trim();
    if (allergies !== undefined && allergies.trim()) client.allergies = allergies.trim();
    if (generalNotes !== undefined && generalNotes.trim()) client.generalNotes = generalNotes.trim();

    const appointments = db.appointments.filter(a => a.clientId === client.id || a.clientDni === cleanDni);
    const technicalRecords = db.technicalRecords.filter(r => r.clientId === client.id);

    return res.json({
      success: true,
      isNew: false,
      message: `¡Bienvenida de nuevo, ${client.name}! Tu historial y puntos están listos.`,
      client,
      appointments,
      technicalRecords
    });
  }

  // Si no existe y no han enviado el nombre, indicar que se requiere completar datos
  if (!name || !name.trim()) {
    return res.status(404).json({
      exists: false,
      needsRegistration: true,
      dni: cleanDni,
      message: 'Este DNI no consta aún en la base de datos. Completa tu nombre y teléfono para registrarte y empezar tu historial (+20 puntos de regalo).'
    });
  }

  // Registrar nueva clienta con su DNI como ID fundamental
  const newId = 'cli-' + Date.now();
  const newClient = {
    id: newId,
    dni: cleanDni,
    name: name.trim(),
    phone: phone ? phone.trim() : '',
    allergies: allergies ? allergies.trim() : 'Sin alergias conocidas',
    generalNotes: generalNotes ? generalNotes.trim() : 'Nueva clienta registrada con DNI',
    loyaltyPoints: 20, // Bonificación de bienvenida (1,00 € dto.)
    googleReviewVerified: false,
    qrCodeHash: `QR-${cleanDni}-${Math.floor(10000 + Math.random() * 90000)}-HASH`,
    marketingConsent: true,
    createdAt: new Date().toISOString()
  };

  db.clients.push(newClient);

  db.loyaltyTransactions.push({
    id: 'loy-' + Date.now(),
    clientId: newClient.id,
    delta: 20,
    newBalance: 20,
    reason: 'WELCOME_BONUS',
    date: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    isNew: true,
    message: `¡Bienvenida a Peluquería Losan, ${newClient.name}! Tu ficha técnica ha sido creada con tu DNI ${cleanDni} y has recibido 20 puntos de bienvenida.`,
    client: newClient,
    appointments: [],
    technicalRecords: []
  });
});

// Búsqueda directa por DNI
app.get('/api/clients/by-dni/:dni', (req, res) => {
  const cleanDni = req.params.dni.trim().toUpperCase().replace(/[\s-]/g, '');
  const client = db.clients.find(c => c.dni && c.dni.toUpperCase() === cleanDni);
  if (!client) {
    return res.status(404).json({ exists: false, error: 'Clienta no encontrada con este DNI.' });
  }

  const appointments = db.appointments.filter(a => a.clientId === client.id || a.clientDni === cleanDni);
  const technicalRecords = db.technicalRecords.filter(r => r.clientId === client.id);

  res.json({
    exists: true,
    client,
    appointments,
    technicalRecords
  });
});

app.get('/api/clients/:id', (req, res) => {
  const client = db.clients.find(c => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: 'Clienta no encontrada.' });

  const records = db.technicalRecords.filter(r => r.clientId === client.id);
  res.json({ ...client, technicalRecords: records });
});

// Listar o filtrar registros técnicos
app.get('/api/technical-records', (req, res) => {
  const { clientId } = req.query;
  if (clientId) {
    return res.json(db.technicalRecords.filter(r => r.clientId === clientId));
  }
  res.json(db.technicalRecords);
});

// Guardar nuevo registro técnico
app.post('/api/technical-records', (req, res) => {
  const { clientId, staffName, dyeFormula, techniqueUsed, exposureTimeMinutes, observations, photoUrl } = req.body;

  if (!clientId || !dyeFormula) {
    return res.status(400).json({ error: 'El ID de la clienta y la fórmula técnica son obligatorios.' });
  }

  const newRecord = {
    id: 'tec-' + Date.now(),
    clientId,
    staffName: staffName || 'Estilista',
    date: new Date().toISOString().slice(0, 10),
    dyeFormula,
    techniqueUsed: techniqueUsed || 'Coloración Estándar',
    exposureTimeMinutes: Number(exposureTimeMinutes) || 30,
    observations: observations || 'Aplicación técnica registrada.',
    photoUrl: photoUrl || 'https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=300&q=80'
  };

  db.technicalRecords.unshift(newRecord);

  // Devolver el expediente completo actualizado de la clienta
  const allRecords = db.technicalRecords.filter(r => r.clientId === clientId);
  res.status(201).json({ success: true, newRecord, allRecords });
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

  const seriesInvoices = db.invoices.filter(i => i.series === series);
  const nextNumber = seriesInvoices.length + 1;
  const previousHash = seriesInvoices.length > 0 
    ? seriesInvoices[seriesInvoices.length - 1].recordHash 
    : '0'.repeat(64);

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

  if (appointmentId) {
    const apt = db.appointments.find(a => a.id === appointmentId);
    if (apt) apt.status = 'completed';
  }

  res.status(201).json(newInvoice);
});

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
  const { message, clientId, clientDni } = req.body;
  const text = (message || '').toLowerCase();

  let client = null;
  if (clientDni) {
    const cleanDni = clientDni.trim().toUpperCase().replace(/[\s-]/g, '');
    client = db.clients.find(c => c.dni && c.dni.toUpperCase() === cleanDni);
  }
  if (!client && clientId) {
    client = db.clients.find(c => c.id === clientId);
  }
  if (!client) {
    client = db.clients[0];
  }

  let toolCalled = null;
  let reply = '';

  if (text.includes('tinte') || text.includes('color') || text.includes('mechas') || text.includes('corte') || text.includes('precio') || text.includes('servicio')) {
    toolCalled = 'get_services_catalog()';
    reply = `¡Hola, ${client.name}! En nuestro salón tenemos los siguientes servicios estrella:\n` +
      `• **Corte y Estilismo**: 30 min (22,00 €)\n` +
      `• **Coloración Completa**: 60 min (38,00 €)\n` +
      `• **Mechas Balayage & Matiz**: 90 min (65,00 €)\n` +
      `• **Tratamiento Olaplex / Keratina**: 45 min (35,00 €)\n\n` +
      `¿Para qué estilista (Elena, Raquel o Carmen) y qué día te gustaría consultar hueco?`;
  } else if (text.includes('elena') || text.includes('raquel') || text.includes('carmen') || text.includes('viernes') || text.includes('mañana') || text.includes('hueco') || text.includes('hora')) {
    toolCalled = 'check_availability(service_ids=["srv-1", "srv-2"], staff="Elena", date="2026-10-23")';
    reply = `He consultado la agenda en directo para el viernes 23 con Elena:\n` +
      `• **13:00** — Disponible ✅\n` +
      `• **17:30** — Disponible ✅\n` +
      `• **18:30** — Disponible ✅\n` +
      `*(A las 10:00 y a las 16:00 tiene citas reservadas).* \n\n` +
      `¿Te reservo a las 17:30 para ${client.name} (DNI: ${client.dni || 'Registrado'})?`;
  } else if (text.includes('17:30') || text.includes('si') || text.includes('sí') || text.includes('reserva') || text.includes('confirma') || text.includes('perfecto')) {
    toolCalled = `book_appointment(client_id="${client.id}", dni="${client.dni || ''}", staff_id="stf-1", start_time="2026-10-23T17:30:00Z")`;
    
    const newApt = {
      id: 'apt-' + Date.now(),
      clientId: client.id,
      clientDni: client.dni || '',
      clientName: client.name,
      staffId: 'stf-1',
      staffName: 'Elena Gómez',
      serviceIds: ['srv-1', 'srv-2'],
      serviceNames: 'Corte y Estilismo + Coloración Completa',
      startTime: '2026-10-23T17:30:00.000Z',
      endTime: '2026-10-23T19:00:00.000Z',
      status: 'confirmed',
      clientComments: 'Reservada automáticamente por el Asistente IA de Citas con DNI ' + (client.dni || 'verificado') + '.',
      reminderSent24h: false,
      reminderSent2h: false,
      createdAt: new Date().toISOString()
    };
    db.appointments.push(newApt);

    reply = `🎉 **¡Cita confirmada con éxito, ${client.name}!**\n\n` +
      `📅 **Fecha**: Viernes, 23 de Octubre de 2026\n` +
      `⏰ **Hora**: 17:30 a 19:00\n` +
      `💇‍♀️ **Estilista**: Elena Gómez\n` +
      `🆔 **DNI Asociado**: ${client.dni || 'Sin DNI'}\n` +
      `✨ **Servicios**: Corte y Estilismo + Coloración Completa\n\n` +
      `Hemos programado tus recordatorios por WhatsApp para 24h y 2h antes de la cita. ¡Queda vinculada directamente a tu expediente técnico de clienta!`;
  } else {
    reply = `¡Hola, ${client.name}! Soy tu asistente personal de citas de Peluquería Losan. Puedes pedirme ver los servicios, consultar huecos libres con Elena, Raquel o Carmen, o decirme qué necesitas y te buscaré la mejor opción. ¿En qué te ayudo hoy?`;
  }

  res.json({ reply, toolCalled });
});

// ============================================================================
// 12. TEST DE DIAGNÓSTICO CAPILAR DIGITAL (CONSULTATION FORMS)
// ============================================================================
app.get('/api/consultations/:idOrDni', (req, res) => {
  const query = req.params.idOrDni.trim().toUpperCase().replace(/[\s-]/g, '');
  const found = db.consultations.find(c => 
    c.clientId === req.params.idOrDni || 
    (c.clientDni && c.clientDni.toUpperCase() === query)
  );

  if (!found) {
    return res.status(404).json({ exists: false, message: 'No hay diagnóstico registrado para esta clienta.' });
  }

  res.json({ exists: true, consultation: found });
});

app.post('/api/consultations', (req, res) => {
  const { clientId, clientDni, clientName, hairType, scalpCondition, chemicalHistory, washFrequency, mainGoal, allergiesConfirmed, patchTestVerified } = req.body;

  if (!clientDni && !clientId) {
    return res.status(400).json({ error: 'El DNI o ID de la clienta es obligatorio.' });
  }

  const cleanDni = clientDni ? clientDni.trim().toUpperCase().replace(/[\s-]/g, '') : '';
  let existing = db.consultations.find(c => 
    (clientId && c.clientId === clientId) || 
    (cleanDni && c.clientDni && c.clientDni.toUpperCase() === cleanDni)
  );

  if (existing) {
    if (hairType) existing.hairType = hairType;
    if (scalpCondition) existing.scalpCondition = scalpCondition;
    if (chemicalHistory) existing.chemicalHistory = chemicalHistory;
    if (washFrequency) existing.washFrequency = washFrequency;
    if (mainGoal) existing.mainGoal = mainGoal;
    if (allergiesConfirmed) existing.allergiesConfirmed = allergiesConfirmed;
    if (patchTestVerified !== undefined) existing.patchTestVerified = patchTestVerified;
    existing.updatedAt = new Date().toISOString();

    // Actualizar también alergias en la ficha maestra del cliente si aplica
    const client = db.clients.find(c => c.id === existing.clientId || (cleanDni && c.dni === cleanDni));
    if (client && allergiesConfirmed) {
      client.allergies = allergiesConfirmed;
    }

    return res.json({ success: true, message: 'Diagnóstico capilar actualizado con éxito.', consultation: existing });
  }

  const newCon = {
    id: 'con-' + Date.now(),
    clientId: clientId || 'cli-' + Date.now(),
    clientDni: cleanDni,
    clientName: clientName || 'Clienta',
    hairType: hairType || 'Normal',
    scalpCondition: scalpCondition || 'Normal',
    chemicalHistory: chemicalHistory || 'Sin químicos recientes',
    washFrequency: washFrequency || 'Cada 2 días',
    mainGoal: mainGoal || 'Mantenimiento saludable',
    allergiesConfirmed: allergiesConfirmed || 'Sin alergias',
    patchTestVerified: patchTestVerified !== undefined ? patchTestVerified : true,
    updatedAt: new Date().toISOString()
  };

  db.consultations.push(newCon);

  // Sincronizar alergias con el cliente
  const client = db.clients.find(c => c.id === newCon.clientId || (cleanDni && c.dni === cleanDni));
  if (client && allergiesConfirmed) {
    client.allergies = allergiesConfirmed;
  }

  res.status(201).json({ success: true, message: 'Test de diagnóstico registrado en base de datos.', consultation: newCon });
});

// ============================================================================
// 13. BONOS DE SESIONES Y PACKS DE SERVICIOS
// ============================================================================
app.get('/api/packages', (req, res) => {
  res.json(db.packages);
});

app.get('/api/packages/client/:idOrDni', (req, res) => {
  const query = req.params.idOrDni.trim().toUpperCase().replace(/[\s-]/g, '');
  const activePackages = db.clientPackages.filter(p => 
    p.clientId === req.params.idOrDni || 
    (p.clientDni && p.clientDni.toUpperCase() === query)
  );

  res.json(activePackages);
});

app.post('/api/packages/purchase', (req, res) => {
  const { packageId, clientId, clientDni } = req.body;
  const pkg = db.packages.find(p => p.id === packageId);
  if (!pkg) return res.status(404).json({ error: 'Bono o pack no encontrado.' });

  let client = null;
  if (clientDni) {
    const cleanDni = clientDni.trim().toUpperCase().replace(/[\s-]/g, '');
    client = db.clients.find(c => c.dni && c.dni.toUpperCase() === cleanDni);
  }
  if (!client && clientId) {
    client = db.clients.find(c => c.id === clientId);
  }
  if (!client) {
    client = db.clients[0];
  }

  const expiresDate = new Date();
  expiresDate.setDate(expiresDate.getDate() + (pkg.validDays || 180));

  const newClientPkg = {
    id: 'cpkg-' + Date.now(),
    packageId: pkg.id,
    packageName: pkg.name,
    clientId: client.id,
    clientDni: client.dni || '',
    clientName: client.name,
    totalSessions: pkg.totalSessions,
    usedSessions: 0,
    remainingSessions: pkg.totalSessions,
    purchaseDate: new Date().toISOString().slice(0, 10),
    expiresAt: expiresDate.toISOString().slice(0, 10),
    status: 'active'
  };

  db.clientPackages.push(newClientPkg);

  // Conceder puntos de fidelización por la compra del bono (1 punto por euro)
  client.loyaltyPoints += Math.floor(pkg.price);

  res.status(201).json({
    success: true,
    message: `¡${pkg.name} adquirido con éxito! Se han sumado +${Math.floor(pkg.price)} puntos de fidelización.`,
    clientPackage: newClientPkg
  });
});

app.post('/api/packages/redeem', (req, res) => {
  const { clientPackageId } = req.body;
  const cpkg = db.clientPackages.find(p => p.id === clientPackageId);
  if (!cpkg) return res.status(404).json({ error: 'Bono no encontrado.' });

  if (cpkg.remainingSessions <= 0) {
    return res.status(400).json({ error: 'No quedan sesiones disponibles en este bono.' });
  }

  cpkg.usedSessions += 1;
  cpkg.remainingSessions -= 1;
  if (cpkg.remainingSessions === 0) {
    cpkg.status = 'consumed';
  }

  res.json({
    success: true,
    message: `Sesión canjeada. Te quedan ${cpkg.remainingSessions} de ${cpkg.totalSessions} sesiones.`,
    clientPackage: cpkg
  });
});

// ============================================================================
// 14. TARJETAS REGALO DIGITALES (GIFT CARDS)
// ============================================================================
app.get('/api/gift-cards', (req, res) => {
  res.json(db.giftCards);
});

app.get('/api/gift-cards/verify/:code', (req, res) => {
  const cleanCode = req.params.code.trim().toUpperCase();
  const card = db.giftCards.find(c => c.code.toUpperCase() === cleanCode);

  if (!card) {
    return res.status(404).json({ valid: false, error: 'Código de Tarjeta Regalo no válido.' });
  }

  if (card.status !== 'active' || card.remainingBalance <= 0) {
    return res.status(400).json({ valid: false, error: 'Esta tarjeta regalo ya ha sido consumida o está caducada.' });
  }

  res.json({ valid: true, card });
});

app.post('/api/gift-cards/buy', (req, res) => {
  const { amount, buyerName, buyerEmail, recipientName, recipientDni, message } = req.body;
  const numAmount = Number(amount);

  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'El importe de la tarjeta regalo debe ser superior a 0 €.' });
  }

  const generatedCode = `REGALO-${Math.round(numAmount)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const expiresDate = new Date();
  expiresDate.setFullYear(expiresDate.getFullYear() + 1);

  const newCard = {
    id: 'gc-' + Date.now(),
    code: generatedCode,
    initialBalance: numAmount,
    remainingBalance: numAmount,
    buyerName: buyerName || 'Cliente Anónimo',
    buyerEmail: buyerEmail || '',
    recipientName: recipientName || 'Destinataria Especial',
    recipientDni: recipientDni ? recipientDni.trim().toUpperCase() : '',
    message: message || 'Disfruta de tu experiencia de belleza en Peluquería Losan.',
    createdAt: new Date().toISOString(),
    expiresAt: expiresDate.toISOString().slice(0, 10),
    status: 'active'
  };

  db.giftCards.push(newCard);

  res.status(201).json({
    success: true,
    message: `Tarjeta Regalo emitida con código único: ${newCard.code} por valor de ${newCard.initialBalance.toFixed(2)} €.`,
    card: newCard
  });
});

app.post('/api/gift-cards/redeem', (req, res) => {
  const { code, amountToDeduct } = req.body;
  const cleanCode = (code || '').trim().toUpperCase();
  const card = db.giftCards.find(c => c.code.toUpperCase() === cleanCode);

  if (!card) return res.status(404).json({ error: 'Tarjeta regalo no encontrada.' });

  const deduct = Number(amountToDeduct);
  if (!deduct || deduct <= 0) return res.status(400).json({ error: 'Importe a descontar inválido.' });

  if (card.remainingBalance < deduct) {
    return res.status(400).json({ error: `Saldo insuficiente. Saldo disponible: ${card.remainingBalance.toFixed(2)} €.` });
  }

  card.remainingBalance = Math.round((card.remainingBalance - deduct) * 100) / 100;
  if (card.remainingBalance === 0) {
    card.status = 'consumed';
  }

  res.json({
    success: true,
    message: `Se han canjeado ${deduct.toFixed(2)} € de la tarjeta regalo. Saldo restante: ${card.remainingBalance.toFixed(2)} €.`,
    remainingBalance: card.remainingBalance
  });
});

// ============================================================================
// 15. LOOKBOOK / GALERÍA ANTES Y DESPUÉS
// ============================================================================
app.get('/api/gallery', (req, res) => {
  res.json(db.galleryLooks);
});

// ============================================================================
// 16. RENDIMIENTO, COMISIONES Y PROPINAS DE ESTILISTAS
// ============================================================================
app.get('/api/staff/:id/performance', (req, res) => {
  const staff = db.staff.find(s => s.id === req.params.id);
  if (!staff) return res.status(404).json({ error: 'Profesional no encontrada.' });

  const staffApts = db.appointments.filter(a => a.staffId === staff.id && a.status === 'confirmed');
  const serviceRevenue = staffApts.length * 35.00; // Estimación media o cálculo real de servicios
  const serviceCommission = Math.round(serviceRevenue * 0.15 * 100) / 100; // 15% comisión por servicio

  const retailCommission = 12.50; // Comisión estimada por venta cosmética (10%)
  const tips = db.staffTips.filter(t => t.staffId === staff.id);
  const totalTips = tips.reduce((sum, t) => sum + t.amount, 0);

  res.json({
    staffId: staff.id,
    staffName: staff.name,
    chair: staff.chair,
    appointmentsCount: staffApts.length,
    serviceRevenue,
    serviceCommission,
    retailCommission,
    totalCommission: serviceCommission + retailCommission,
    tipsCount: tips.length,
    totalTips,
    tips
  });
});

app.post('/api/staff/:id/tips', (req, res) => {
  const staff = db.staff.find(s => s.id === req.params.id);
  if (!staff) return res.status(404).json({ error: 'Profesional no encontrada.' });

  const { amount, paymentMethod = 'bizum', clientName } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Importe de propina inválido.' });
  }

  const newTip = {
    id: 'tip-' + Date.now(),
    staffId: staff.id,
    amount: numAmount,
    paymentMethod,
    clientName: clientName || 'Clienta agradecida',
    date: new Date().toISOString().slice(0, 10)
  };

  db.staffTips.push(newTip);

  res.status(201).json({
    success: true,
    message: `¡Propina de ${numAmount.toFixed(2)} € registrada para ${staff.name}!`,
    tip: newTip
  });
});

// ============================================================================
// 17. DASHBOARD DE KPIS & BUSINESS INTELLIGENCE
// ============================================================================
app.get('/api/analytics/kpis', (req, res) => {
  const totalInvoices = db.invoices.length;
  const totalRevenue = db.invoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const averageTicket = totalInvoices > 0 ? (totalRevenue / totalInvoices) : 38.50;

  const totalClients = db.clients.length;
  const totalAppointments = db.appointments.filter(a => a.status === 'confirmed').length;

  // Tasa de ocupación: total minutos reservados vs minutos disponibles (3 estilistas x 10h = 1800 min)
  const totalBookedMinutes = totalAppointments * 45;
  const capacityMinutes = 3 * 10 * 60; // 1800 min
  const occupancyRate = Math.min(100, Math.round((totalBookedMinutes / capacityMinutes) * 100));

  res.json({
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    averageTicket: Math.round(averageTicket * 100) / 100,
    occupancyRate, // %
    totalAppointments,
    totalClients,
    totalInvoices,
    rebookingRate: 78.5, // %
    executiveCards: {
      totalRevenueMonth: '8.450 €',
      averageTicket: '44,50 €',
      chairOccupancyRate: '87 %',
      clientRetentionRate: '74 %'
    },
    staffPerformanceBreakdown: [
      { staffName: 'Elena Gómez', appointmentsCompleted: 14, revenueGenerated: 3480.00, commissionsEarned: 522.00, tipsCollected: 115.00 },
      { staffName: 'Raquel Santos', appointmentsCompleted: 19, revenueGenerated: 2790.00, commissionsEarned: 418.50, tipsCollected: 95.00 },
      { staffName: 'Carmen Vidal', appointmentsCompleted: 11, revenueGenerated: 2180.00, commissionsEarned: 327.00, tipsCollected: 70.00 }
    ],
    topServicesByRevenue: [
      { name: 'Mechas Balayage & Matiz', duration: '90 min', unitPrice: 65.00, margin: 'Alta Demanda' },
      { name: 'Coloración Completa (Tinte)', duration: '60 min', unitPrice: 38.00, margin: 'Fidelización' },
      { name: 'Tratamiento Olaplex / Keratina', duration: '45 min', unitPrice: 35.00, margin: 'Alto Margen' },
      { name: 'Corte y Estilismo', duration: '30 min', unitPrice: 22.00, margin: 'Base Diaria' }
    ],
    topServices: [
      { name: 'Mechas Balayage & Matiz', count: 18, share: '36%' },
      { name: 'Coloración Completa (Tinte)', count: 14, share: '28%' },
      { name: 'Corte y Estilismo', count: 12, share: '24%' },
      { name: 'Tratamiento Olaplex', count: 6, share: '12%' }
    ]
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n==========================================================`);
  console.log(`🚀 SERVIDOR PELUQUERÍA INTEGRAL EN EJECUCIÓN`);
  console.log(`👉 URL Local: http://localhost:${PORT}`);
  console.log(`👉 Cumplimiento Veri*Factu (Ley 11/2021) Activo`);
  console.log(`==========================================================\n`);
});
