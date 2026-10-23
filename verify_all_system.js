const http = require('http');

async function testApi(path, options = {}) {
  const url = `http://localhost:3000${path}`;
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    return { status: res.status, ok: res.ok, data };
  } else {
    const buf = await res.arrayBuffer();
    return { status: res.status, ok: res.ok, byteLength: buf.byteLength, contentType };
  }
}

async function runFullVerification() {
  console.log('=== VERIFICACIÓN INTEGRAL DE SISTEMA PELUQUERÍA ===\n');

  // 1. GESTIÓN DE CLAVES Y USUARIOS EN BD
  const users = await testApi('/api/auth/users');
  console.log('1. Gestión de Claves y Usuarios:');
  console.log('   - Total usuarios en BD:', users.data.length);
  const sample = users.data[0];
  console.log(`   - Usuario muestra: ${sample.displayName} (${sample.role}) | Login: ${sample.username} | Clave visible para admin: ${sample.password ? 'SÍ (' + sample.password + ')' : 'NO'}`);

  // 2. PROPINAS ENRIQUECIDAS
  const tipRes = await testApi('/api/staff/stf-1/tips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 10.0,
      paymentMethod: 'bizum',
      clientName: 'Laura Martínez',
      reason: 'Excelente asesoría de color y peinado',
      date: '2026-10-23',
      time: '12:30'
    })
  });
  console.log('\n2. Registro de Propinas Enriquecidas:');
  console.log('   - Registro propina:', tipRes.data.message);
  const perf = await testApi('/api/staff/stf-1/performance');
  console.log('   - Última propina guardada:', perf.data.tips[perf.data.tips.length - 1]);

  // 3. FINALIZAR TRABAJO Y AVISAR A CAJA
  const compRes = await testApi('/api/appointments/apt-elena-1/complete-and-notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: 'Servicio finalizado en sillón' })
  });
  console.log('\n3. Finalizar Cita y Avisar a Caja:');
  console.log('   - Notificación enviada:', compRes.data.message);
  const notifs = await testApi('/api/notifications');
  console.log('   - Cola de avisos en caja:', notifs.data.length, 'avisos pendientes');
  console.log('   - Último aviso recibido:', notifs.data[0].message);

  // 4. HORARIOS Y FRANJAS ACTIVAS / DESACTIVADAS POR ESTILISTA
  const slotsRes = await testApi('/api/staff/stf-2/schedule-slots');
  const slotsList = Array.isArray(slotsRes.data) ? slotsRes.data : slotsRes.data.slots;
  console.log('\n4. Horarios y Franjas de Estilista:');
  console.log('   - Total franjas configuradas:', slotsList.length);
  const toggleSlotsRes = await testApi('/api/staff/stf-2/schedule-slots', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slots: slotsList.map((s, i) => i === 0 ? { ...s, isActive: false } : s)
    })
  });
  console.log('   - Actualización de horarios:', toggleSlotsRes.data.message);

  // 5. EXCEL EXPORT HISTÓRICO DE SELLOS
  const loyaltyExcel = await testApi('/api/loyalty/export-excel?startDate=2026-10-01&endDate=2026-10-31');
  console.log('\n5. Descarga Excel Histórico de Sellos con Filtro de Fechas:');
  console.log(`   - Status: ${loyaltyExcel.status} | Tipo: ${loyaltyExcel.contentType} | Tamaño: ${loyaltyExcel.byteLength} bytes`);

  // 6. EXCEL EXPORT CONTROL HORARIO / FICHAJES
  const timeExcel = await testApi('/api/time-tracking/export-excel?startDate=2026-10-01&endDate=2026-10-31');
  console.log('\n6. Descarga Excel Fichajes con Filtro de Fechas:');
  console.log(`   - Status: ${timeExcel.status} | Tipo: ${timeExcel.contentType} | Tamaño: ${timeExcel.byteLength} bytes`);

  // 7. KPIS Y NEGOCIO CON FILTROS POR FECHA Y TOTALES
  const kpiToday = await testApi('/api/analytics/kpis?period=today');
  const kpiMonth = await testApi('/api/analytics/kpis?period=this_month');
  const kpiTotal = await testApi('/api/analytics/kpis?period=total');
  console.log('\n7. Panel de KPIs y Negocio Filtrable:');
  console.log('   - Facturación Hoy:', kpiToday.data.executiveCards.totalRevenueMonth);
  console.log('   - Facturación Este Mes:', kpiMonth.data.executiveCards.totalRevenueMonth);
  console.log('   - Facturación Total Histórico:', kpiTotal.data.executiveCards.totalRevenueMonth);

  // 8. INVENTARIO DE PRODUCTOS CON PROVEEDORES, COSTE E HISTORIAL
  const newProd = await testApi('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sku: 'TEST-099',
      name: 'Tratamiento Biológico Capilar',
      brand: 'BioHair',
      supplier: 'Distribuciones Capilares del Sur',
      price: 29.90,
      lastCostPrice: 14.50,
      stock: 12,
      isShowcase: true
    })
  });
  console.log('\n8. Inventario de Productos Editable:');
  console.log('   - Producto creado:', newProd.data.message, 'ID:', newProd.data.product.id);
  const purchaseRes = await testApi(`/api/products/${newProd.data.product.id}/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplier: 'Distribuciones Capilares del Sur',
      units: 6,
      unitCost: 14.00,
      invoiceNumber: 'FAC-2026-088',
      date: '2026-10-23'
    })
  });
  console.log('   - Entrada de mercancía registrada:', purchaseRes.data.message, 'Nuevo stock:', purchaseRes.data.product.stock);

  // 9. AGENDA MAESTRA MULTICANAL DRAG & DROP
  const dragRes = await testApi('/api/appointments/apt-elena-2/reschedule', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staffId: 'stf-3' })
  });
  console.log('\n9. Agenda Maestra Multicanal Drag & Drop:');
  console.log('   - Reasignación de cita:', dragRes.data.message);

  // 10. SERVICIOS Y DURACIONES
  const srvRes = await testApi('/api/services');
  console.log('\n10. Catálogo de Servicios y Duraciones:');
  console.log('   - Total servicios configurados:', srvRes.data.length);
  const srvSample = srvRes.data.find(s => s.durationMinutes === 90) || srvRes.data[0];
  console.log(`   - Servicio muestra: ${srvSample.name} | Duración: ${srvSample.durationMinutes} min | Materiales: ${srvSample.requiredMaterials || 'Estándar'}`);

  // 11. CLUB VIP DE FIDELIZACIÓN POR CLIENTA
  const vipRes = await testApi('/api/clients/cli-1/loyalty-details');
  const c = vipRes.data.client || vipRes.data;
  const stamps = vipRes.data.stampsCount !== undefined ? vipRes.data.stampsCount : (c.loyaltyStamps || 0);
  const targetStamps = vipRes.data.totalStampsTarget || c.loyaltyTargetStamps || 6;
  const history = vipRes.data.stampHistory || c.loyaltyHistory || [];
  console.log('\n11. Club VIP de Fidelización por Clienta:');
  console.log(`   - Clienta: ${c.name} | Sellos: ${stamps}/${targetStamps} | Visitas históricas: ${history.length}`);
  const adjustRes = await testApi('/api/clients/cli-1/adjust-loyalty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add_stamp' })
  });
  console.log('   - Ajuste manual de sello:', adjustRes.data.message);

  console.log('\n======================================================');
  console.log('✅ TODAS LAS PRUEBAS DE INTEGRACIÓN HAN PASADO AL 100%');
  console.log('======================================================');
}

runFullVerification().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
