const assert = require('assert');

async function testAll() {
  console.log('=== VERIFICANDO TODAS LAS NUEVAS FUNCIONALIDADES ===\n');

  // 1. Verificar Agenda Maestra y aviso a ambas estilistas al reasignar cita
  console.log('1. Agenda Maestra Multicanal y Notificación Dual a Estilistas:');
  const reschedRes = await fetch('http://localhost:3000/api/appointments/apt-elena-2/reschedule', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staffId: 'stf-3',
      startTime: '2026-10-23T11:00:00.000Z',
      endTime: '2026-10-23T11:45:00.000Z'
    })
  });
  assert.strictEqual(reschedRes.status, 200, 'Reschedule status should be 200');
  const reschedData = await reschedRes.json();
  console.log('   ✅ Cita reubicada:', reschedData.message);

  const notifsRes = await fetch('http://localhost:3000/api/notifications');
  const notifs = await notifsRes.json();
  const lossNotif = notifs.find(n => n.type === 'reassignment_loss' && n.targetStaffId === 'stf-1');
  const gainNotif = notifs.find(n => n.type === 'reassignment_gain' && n.targetStaffId === 'stf-3');
  assert.ok(lossNotif, 'Debe existir notificación de pérdida para estilista 1');
  assert.ok(gainNotif, 'Debe existir notificación de ganancia para estilista 3');
  console.log('   ✅ Notificación estilista que cede:', lossNotif.message);
  console.log('   ✅ Notificación estilista que recibe:', gainNotif.message);

  // 2. Verificar Cobro con Metálico, Bizum y Tarjeta
  console.log('\n2. Avisos de Cobro en Caja con Metálico y Bizum:');
  const chargeCashRes = await fetch('http://localhost:3000/api/payments/charge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: 'Clienta Pago Metálico',
      concept: 'Corte y Lavado Relajante',
      amount: 30.00,
      paymentMethod: 'cash',
      staffName: 'Elena Gómez'
    })
  });
  assert.strictEqual(chargeCashRes.status, 201, 'Cobro metálico status should be 201');
  const cashData = await chargeCashRes.json();
  console.log('   ✅ Cobro en Metálico emitido:', cashData.invoice.invoiceNumber, '| Total:', cashData.invoice.totalAmount + ' €');

  const chargeBizumRes = await fetch('http://localhost:3000/api/payments/charge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: 'Clienta Pago Bizum',
      concept: 'Tratamiento Brillo Intenso',
      amount: 42.00,
      paymentMethod: 'bizum',
      staffName: 'Raquel Santos'
    })
  });
  assert.strictEqual(chargeBizumRes.status, 201, 'Cobro bizum status should be 201');
  const bizumData = await chargeBizumRes.json();
  console.log('   ✅ Cobro en Bizum emitido:', bizumData.invoice.invoiceNumber, '| Total:', bizumData.invoice.totalAmount + ' €');

  // 3. Ficha 360 de Clientas Totalmente Editable
  console.log('\n3. Ficha 360 de Clientas Totalmente Editable:');
  const client360Res = await fetch('http://localhost:3000/api/clients/cli-2', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sofía Morales Actualizada',
      phone: '34699887766',
      hairType: 'Rizado 3A-3C',
      scalpType: 'Sensible reactivo',
      allergies: 'Sensibilidad a perfumes concentrados',
      technicalFormulas: 'Base 7.3 con oxidante 10vol sin amoníaco',
      preferredStylist: 'Raquel Santos',
      beveragePreference: 'Té verde con limón',
      generalNotes: 'Le encanta el secado con difusor y definición con crema leave-in',
      stampsCount: 5,
      loyaltyPoints: 180
    })
  });
  assert.strictEqual(client360Res.status, 200, 'Client 360 PUT status should be 200');
  const client360Data = await client360Res.json();
  console.log('   ✅ Ficha 360 guardada para:', client360Data.client.name);
  console.log('   ✅ Diagnóstico Capilar:', client360Data.client.hairType, '| Cuero cabelludo:', client360Data.client.scalpType);
  console.log('   ✅ Preferencias:', client360Data.client.preferredStylist, '| Bebida:', client360Data.client.beveragePreference);
  console.log('   ✅ Fidelización:', client360Data.client.stampsCount + '/8 sellos | Puntos:', client360Data.client.loyaltyPoints + ' pts');

  // 4. Horarios de Estilista (Días de Descanso, Días Extra, Horas Extras)
  console.log('\n4. Horarios del Equipo Profesional:');
  const schedulePutRes = await fetch('http://localhost:3000/api/staff/stf-2/schedule', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restDays: ['Lunes', 'Domingo'],
      vacationDates: ['2026-08-15', '2026-08-16', '2026-08-17'],
      extraDays: [{ date: '2026-10-24', shift: '09:00 - 15:00', reason: 'Refuerzo sábado de bodas' }],
      shiftType: 'PERSONALIZADO'
    })
  });
  assert.strictEqual(schedulePutRes.status, 200, 'Schedule PUT status should be 200');
  const scheduleData = await schedulePutRes.json();
  console.log('   ✅ Horarios configurados para Raquel Santos:');
  console.log('   ✅ Días de descanso:', scheduleData.schedule.restDays.join(', '));
  console.log('   ✅ Vacaciones planificadas:', scheduleData.schedule.vacationDates.join(', '));
  console.log('   ✅ Días extra de refuerzo:', scheduleData.schedule.extraDays.length, 'días');

  const overtimeRes = await fetch('http://localhost:3000/api/staff/stf-2/overtime', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: '2026-10-23',
      hours: 2.0,
      reason: 'Prolongación servicio balayage clienta Carmen'
    })
  });
  assert.strictEqual(overtimeRes.status, 201, 'Overtime POST status should be 201');
  const overtimeData = await overtimeRes.json();
  console.log('   ✅ Registro de horas extras:', overtimeData.record.hours + 'h | Motivo:', overtimeData.record.reason);

  // 5. Sellado Manual de Fidelización
  console.log('\n5. Sellado Manual de Tarjetas de Fidelización:');
  const stampRes = await fetch('http://localhost:3000/api/clients/cli-1/adjust-loyalty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add_stamp', staffName: 'Administración TPV' })
  });
  assert.strictEqual(stampRes.status, 200, 'Manual stamp status should be 200');
  const stampData = await stampRes.json();
  console.log('   ✅ Sellado manual aplicado:', stampData.message);
  console.log('   ✅ Nuevo conteo sellos:', stampData.stampsCount + '/' + stampData.totalStampsTarget);

  // 6. Control Horario y Fichajes con Consulta de Cualquier Día o Periodo
  console.log('\n6. Control Horario y Fichajes con Consulta por Periodo:');
  const timeQueryRes = await fetch('http://localhost:3000/api/time-tracking/records?startDate=2026-10-01&endDate=2026-10-31');
  assert.strictEqual(timeQueryRes.status, 200, 'Time tracking query status should be 200');
  const timeQueryData = await timeQueryRes.json();
  console.log('   ✅ Total registros en el periodo 01/10/2026 - 31/10/2026:', timeQueryData.count);
  console.log('   ✅ Horas efectivas totales en periodo:', timeQueryData.totalEffectiveHours + ' h');
  console.log('   ✅ Horas extras totales en periodo:', timeQueryData.totalOvertimeHours + ' h');

  const excelExportRes = await fetch('http://localhost:3000/api/time-tracking/export-excel?startDate=2026-10-01&endDate=2026-10-31&format=xlsx');
  assert.strictEqual(excelExportRes.status, 200, 'Excel export status should be 200');
  const excelBuffer = await excelExportRes.arrayBuffer();
  console.log('   ✅ Descarga de Excel oficial del periodo generada exitosamente:', excelBuffer.byteLength, 'bytes');

  console.log('\n======================================================');
  console.log('🎉 TODAS LAS 6 NUEVAS FUNCIONALIDADES OPERAN AL 100%');
  console.log('======================================================');
}

testAll().catch(err => {
  console.error('❌ Error en las pruebas:', err);
  process.exit(1);
});
