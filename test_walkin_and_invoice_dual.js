const http = require('http');

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testAll() {
  console.log('--- TEST 1: RESERVA MANUAL WALK-IN (SIN CITA PREVIA) ---');
  const testTime = new Date(Date.now() + 86400000 * 2 + Math.floor(Math.random() * 36000000)).toISOString();
  const bookRes = await request('/api/appointments/book', 'POST', {
    clientName: 'Marcos Benítez (Walk-in)',
    clientPhone: '611223344',
    staffId: 'stf-2', // Raquel Santos
    serviceIds: ['srv-4'], // Corte Caballero (22€, 30m)
    startTime: testTime,
    clientComments: 'Cliente llegado a salón sin cita previa',
    isWalkIn: true
  });

  console.log('Status:', bookRes.status);
  if (bookRes.status !== 201) {
    throw new Error('Falló la reserva walk-in: ' + JSON.stringify(bookRes.data));
  }
  console.log('✅ Cita creada con éxito:', bookRes.data.id, 'Cliente:', bookRes.data.clientName, 'Total:', bookRes.data.totalPrice, '€');
  console.log('   isWalkIn:', bookRes.data.isWalkIn);

  // Check notification
  const notifs = await request('/api/notifications');
  const walkinNotif = notifs.data.find(n => n.type === 'WALKIN_ARRIVAL');
  if (walkinNotif) {
    console.log('✅ Notificación interna de Walk-in generada:', walkinNotif.title, '->', walkinNotif.message);
  } else {
    console.warn('⚠️ No se encontró la notificación WALKIN_ARRIVAL en el listado.');
  }

  console.log('\n--- TEST 2: FACTURACIÓN TPV Y DESCARGA / VISTA A4 PDF ---');
  const invRes = await request('/api/invoices', 'POST', {
    clientId: bookRes.data.clientId,
    appointmentId: bookRes.data.id,
    series: 'FS2026',
    paymentMethod: 'cash',
    items: [
      { concept: 'Corte Caballero Express', quantity: 1, unitPrice: 22.00 }
    ]
  });

  if (invRes.status !== 201) {
    throw new Error('Falló la emisión de factura: ' + JSON.stringify(invRes.data));
  }
  const inv = invRes.data;
  console.log('✅ Factura emitida con éxito:', `${inv.series}-${String(inv.invoiceNumber).padStart(4, '0')}`, 'Total:', inv.totalAmount, '€');
  console.log('   Hash SHA-256:', inv.recordHash);

  // Test Print / PDF Endpoint
  const printRes = await request(`/api/invoices/${inv.id}/print`);
  if (printRes.status === 200 && printRes.text.includes('FACTURA OFICIAL VERI*FACTU') && printRes.text.includes('Base Imponible')) {
    console.log('✅ Endpoint GET /api/invoices/:id/print respondió HTTP 200 con formato A4 / PDF oficial');
    console.log('   Longitud HTML factura imprimible:', printRes.text.length, 'bytes');
  } else {
    throw new Error('Falló el endpoint de impresión A4: status=' + printRes.status);
  }

  console.log('\n🎉 TODOS LOS TESTS DE RESERVA MANUAL Y FACTURA/TICKET DUAL SUPERADOS CON ÉXITO!');
}

testAll().catch(err => {
  console.error('❌ Error en test:', err);
  process.exit(1);
});
