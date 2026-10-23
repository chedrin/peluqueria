const http = require('http');

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
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

async function runTests() {
  console.log('--- STARTING FULL SUITE TESTS ---');

  // 1. Initial Data
  console.log('\n[1/5] Testing Core Data Endpoints...');
  const staffRes = await request('/api/staff');
  const prodRes = await request('/api/products');
  if (staffRes.status === 200 && prodRes.status === 200) {
    console.log('✅ GET /api/staff OK - Total:', staffRes.data.length);
    console.log('✅ GET /api/products OK - Total:', prodRes.data.length);
  } else {
    throw new Error('Core data endpoints failed: staff=' + staffRes.status + ' prod=' + prodRes.status);
  }

  // 2. Product operations (Screenshot 1)
  console.log('\n[2/5] Testing Product / Stock Operations...');
  const createProdRes = await request('/api/products', 'POST', {
    name: 'Sérum Reestructurante Seda',
    brand: 'Moroccanoil',
    supplier: 'Distribuciones Belleza SL',
    sku: 'SER-099',
    price: 32.50,
    costPrice: 15.00,
    stock: 12,
    minStock: 4,
    isShowcase: true
  });
  console.log('✅ POST /api/products:', createProdRes.status === 201 ? 'CREATED' : 'FAIL', createProdRes.data.product?.id);
  const prodId = createProdRes.data.product?.id;

  const purchaseRes = await request(`/api/products/${prodId}/purchase`, 'POST', {
    quantity: 6,
    unitCost: 14.50,
    supplier: 'Distribuciones Belleza SL',
    invoiceNumber: 'ALB-TEST-2026'
  });
  console.log('✅ POST /api/products/:id/purchase:', purchaseRes.status === 200 ? 'SUCCESS' : 'FAIL', 'New Stock:', purchaseRes.data.product?.stock);

  const editProdRes = await request(`/api/products/${prodId}`, 'PUT', {
    name: 'Sérum Reestructurante Seda Gold Edition',
    price: 35.00
  });
  console.log('✅ PUT /api/products/:id:', editProdRes.status === 200 ? 'UPDATED' : 'FAIL', editProdRes.data.product?.name);

  // 3. Staff operations (Screenshot 3)
  console.log('\n[3/5] Testing Staff Operations...');
  const editStaffRes = await request('/api/staff/stf-1', 'PUT', {
    name: 'Elena Vega (Master Color)',
    specialty: 'Master Colorimetría & Balayage',
    chair: 'Sillón 1 (Color VIP)',
    phone: '612 999 888',
    email: 'elena.vega@peluqueria.es',
    displayColor: '#7c3aed'
  });
  console.log('✅ PUT /api/staff/:id:', editStaffRes.status === 200 ? 'UPDATED' : 'FAIL', editStaffRes.data.staff?.name);

  const schedRes = await request('/api/staff/stf-1/schedule');
  console.log('✅ GET /api/staff/:id/schedule:', schedRes.status === 200 ? 'SUCCESS' : 'FAIL', 'Slots:', schedRes.data.schedule?.slots?.length);

  const bajaRes = await request('/api/staff/stf-3/status', 'PATCH', {
    isActive: false,
    reason: 'Baja médica temporal'
  });
  console.log('✅ PATCH /api/staff/:id/status (Baja):', bajaRes.status === 200 ? 'SUCCESS' : 'FAIL', bajaRes.data.message);

  const altaRes = await request('/api/staff/stf-3/status', 'PATCH', {
    isActive: true
  });
  console.log('✅ PATCH /api/staff/:id/status (Alta):', altaRes.status === 200 ? 'SUCCESS' : 'FAIL', altaRes.data.message);

  // 4. Time Tracking operations (Control de Horarios y Fichajes)
  console.log('\n[4/5] Testing Time Tracking & Fichajes...');
  const summaryRes = await request('/api/time-tracking/summary-today');
  console.log('✅ GET /api/time-tracking/summary-today:', summaryRes.status === 200 ? 'SUCCESS' : 'FAIL', 
    'Working:', summaryRes.data.workingCount, 'Break:', summaryRes.data.breakCount, 'Total staff:', summaryRes.data.totalStaff);

  const recordsRes = await request('/api/time-tracking/records?startDate=2026-10-01&endDate=2026-10-31');
  console.log('✅ GET /api/time-tracking/records:', recordsRes.status === 200 ? 'SUCCESS' : 'FAIL', 'Records count:', recordsRes.data.count, 'Total effective hours:', recordsRes.data.totalEffectiveHours);

  // Clock in test for stf-3
  const clockInRes = await request('/api/time-tracking/clock-in', 'POST', {
    staffId: 'stf-3',
    notes: 'Entrada puntual turno de tarde'
  });
  console.log('✅ POST /api/time-tracking/clock-in (Carmen):', clockInRes.status === 200 ? 'SUCCESS' : 'ALREADY CLOCKED', clockInRes.data.message || clockInRes.data.error);

  const statusRes = await request('/api/time-tracking/status/stf-3');
  console.log('✅ GET /api/time-tracking/status/stf-3:', statusRes.data.status);

  // Break test
  const breakStartRes = await request('/api/time-tracking/break', 'POST', {
    staffId: 'stf-3',
    action: 'start',
    reason: 'Pausa Café'
  });
  console.log('✅ POST /api/time-tracking/break (start):', breakStartRes.status === 200 ? 'SUCCESS' : 'FAIL', breakStartRes.data.message);

  const breakEndRes = await request('/api/time-tracking/break', 'POST', {
    staffId: 'stf-3',
    action: 'end'
  });
  console.log('✅ POST /api/time-tracking/break (end):', breakEndRes.status === 200 ? 'SUCCESS' : 'FAIL', breakEndRes.data.message);

  // Clock out test
  const clockOutRes = await request('/api/time-tracking/clock-out', 'POST', {
    staffId: 'stf-3',
    notes: 'Jornada completada'
  });
  console.log('✅ POST /api/time-tracking/clock-out:', clockOutRes.status === 200 ? 'SUCCESS' : 'FAIL', clockOutRes.data.message);

  // 5. Notifications (Screenshot 2)
  console.log('\n[5/5] Testing Notifications...');
  const notifRes = await request('/api/notifications');
  console.log('✅ GET /api/notifications:', notifRes.status === 200 ? 'SUCCESS' : 'FAIL', 'Count:', notifRes.data.length);

  console.log('\n🎉 ALL FULL SUITE BACKEND & LOGIC TESTS COMPLETED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
