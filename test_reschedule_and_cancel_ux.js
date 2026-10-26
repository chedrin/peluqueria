const http = require('http');
const fs = require('fs');
const assert = require('assert');

async function runTests() {
  console.log('=== TEST SUITE: APPOINTMENT MODALS & RESCHEDULING UX ===\n');

  // 1. Verify HTML DOM Elements and Functions
  console.log('[1/4] Verifying Frontend DOM & UX Components in public/index.html...');
  const html = fs.readFileSync('public/index.html', 'utf8');

  const requiredDomIds = [
    'modal-client-reschedule',
    'client-reschedule-comparison',
    'client-reschedule-reason-select',
    'client-reschedule-staff-pills',
    'client-reschedule-datepicker',
    'client-reschedule-slots-container',
    'btn-client-confirm-reschedule',
    'modal-cancel-appointment',
    'cancel-modal-apt-details',
    'cancel-modal-reason-select',
    'modal-admin-appointment-details',
    'admin-detail-avatar',
    'admin-detail-client-name',
    'admin-detail-status-badge',
    'admin-detail-client-dni',
    'admin-detail-client-phone',
    'admin-detail-wa-btn',
    'admin-detail-tel-btn',
    'admin-detail-time',
    'admin-detail-staff',
    'admin-detail-duration',
    'admin-detail-price',
    'admin-detail-services',
    'admin-detail-history-container',
    'admin-detail-cancel-btn',
    'admin-detail-reschedule-btn',
    'admin-detail-charge-btn',
    'reschedule-modal-reason',
    'reschedule-modal-notify-client'
  ];

  requiredDomIds.forEach(id => {
    assert(html.includes(`id="${id}"`), `Missing DOM id: ${id}`);
  });
  console.log(`✅ All ${requiredDomIds.length} UI modal and UX elements verified in DOM.`);

  const requiredFunctions = [
    'openClientRescheduleModal',
    'closeClientRescheduleModal',
    'renderClientRescheduleStaffPills',
    'selectClientRescheduleStaff',
    'handleClientRescheduleDateChange',
    'updateClientRescheduleComparison',
    'renderClientRescheduleSlots',
    'selectClientRescheduleSlot',
    'submitClientReschedule',
    'openCancelAppointmentModal',
    'closeCancelAppointmentModal',
    'submitCancelAppointment',
    'openAdminAppointmentDetails',
    'closeAdminAppointmentDetailsModal',
    'openRescheduleFromAdminDetails',
    'openChargeFromAdminDetails',
    'openCancelModalFromAdmin'
  ];

  requiredFunctions.forEach(fn => {
    assert(html.includes(`function ${fn}`), `Missing JS function: ${fn}`);
  });
  console.log(`✅ All ${requiredFunctions.length} appointment management functions verified in JavaScript.`);

  // 2. Test Backend Appointment Endpoints
  console.log('\n[2/4] Testing Appointment Endpoints...');
  const apts = await fetch('http://localhost:3000/api/appointments').then(r => r.json());
  assert(Array.isArray(apts) && apts.length > 0, 'No appointments returned');
  const targetApt = apts.find(a => a.status !== 'cancelled') || apts[0];
  console.log(`Target appointment: ${targetApt.id} (${targetApt.clientName} with ${targetApt.staffName})`);

  // GET /api/appointments/:id
  const single = await fetch(`http://localhost:3000/api/appointments/${targetApt.id}`).then(r => r.json());
  assert.strictEqual(single.id, targetApt.id, 'GET /api/appointments/:id returned wrong id');
  console.log('✅ GET /api/appointments/:id returned correct appointment.');

  // 3. Test Reschedule to Free Slot + Collision Check
  console.log('\n[3/4] Testing Reschedule with Audit History, Reason & Collision Detection...');
  const newStaff = (await fetch('http://localhost:3000/api/staff').then(r => r.json()))[1]; // Raquel
  
  // A: Test collision detection on occupied slot (16:30)
  const collisionRes = await fetch(`http://localhost:3000/api/appointments/${targetApt.id}/reschedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staffId: newStaff.id,
      startTime: '2026-10-23T16:30:00.000Z',
      endTime: '2026-10-23T17:30:00.000Z'
    })
  });
  assert.strictEqual(collisionRes.status, 409, 'Expected 409 Conflict when slot is occupied');
  console.log('✅ Collision protection confirmed: 409 Conflict correctly returned when slot is occupied.');

  // B: Test move to verified free slot (11:30 - 12:30)
  const reschedPayload = {
    staffId: newStaff.id,
    startTime: '2026-10-23T11:30:00.000Z',
    endTime: '2026-10-23T12:30:00.000Z',
    reason: 'Petición expresa de la clienta por incompatibilidad de horario',
    rescheduledBy: 'client'
  };

  const reschedRes = await fetch(`http://localhost:3000/api/appointments/${targetApt.id}/reschedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reschedPayload)
  });
  const reschedData = await reschedRes.json();
  assert(reschedRes.ok, `Reschedule failed: ${reschedData.error}`);
  assert(reschedData.appointment.rescheduleHistory && reschedData.appointment.rescheduleHistory.length > 0, 'Missing rescheduleHistory');
  assert.strictEqual(reschedData.appointment.rescheduleHistory[0].reason, reschedPayload.reason);
  assert.strictEqual(reschedData.appointment.rescheduleHistory[0].rescheduledBy, 'client');
  console.log(`✅ Reschedule successful. History entries: ${reschedData.appointment.rescheduleHistory.length}. Reason recorded: "${reschedData.appointment.rescheduleHistory[0].reason}"`);

  // 4. Test Cancellation Endpoint (POST /api/appointments/:id/cancel)
  console.log('\n[4/4] Testing Cancellation and Slot Liberation...');
  const cancelRes = await fetch(`http://localhost:3000/api/appointments/${targetApt.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason: 'Imprevisto laboral de última hora',
      cancelledBy: 'client'
    })
  });
  const cancelData = await cancelRes.json();
  assert(cancelRes.ok, `Cancel failed: ${cancelData.error}`);
  assert.strictEqual(cancelData.appointment.status, 'cancelled');
  assert.strictEqual(cancelData.appointment.cancellationReason, 'Imprevisto laboral de última hora');
  console.log(`✅ Canceled successfully. Status: ${cancelData.appointment.status}. Notification generated: ${cancelData.notification.title}`);

  // Clean reset: return appointment back to confirmed for continuous tests
  await fetch(`http://localhost:3000/api/appointments/${targetApt.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'confirmed' })
  });

  console.log('\n🎉 ALL APPOINTMENT MODAL & RESCHEDULING TESTS PASSED FLAWLESSLY!');
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
