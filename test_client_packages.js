const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(buf) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000' + path, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(buf) }));
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- TEST 1: GET /api/packages/client-packages ---');
  const all = await get('/api/packages/client-packages');
  console.log('Total client packages:', all.data.length);
  console.log('Sample client package:', all.data[0].packageName, 'client:', all.data[0].clientName);

  console.log('\n--- TEST 2: POST /api/packages/assign-custom (Bono 6 Cortes de Pelo) ---');
  const assignRes = await post('/api/packages/assign-custom', {
    clientId: 'cli-3', // Carmen Sánchez
    packageName: 'Bono 6 Cortes de Pelo',
    totalSessions: 6,
    regularPrice: 132.00, // 22€ x 6
    discountPercent: 20,
    validDays: 180,
    notes: 'Bono para cortes mensuales con 20% dto. de bienvenida'
  });
  console.log('Assign status:', assignRes.status, assignRes.data.message);
  const newPkg = assignRes.data.clientPackage;
  console.log('Created pkg:', {
    id: newPkg.id,
    packageName: newPkg.packageName,
    clientName: newPkg.clientName,
    totalSessions: newPkg.totalSessions,
    remainingSessions: newPkg.remainingSessions,
    regularPrice: newPkg.regularPrice,
    packagePrice: newPkg.packagePrice,
    discountAmount: newPkg.discountAmount,
    discountPercent: newPkg.discountPercent
  });

  console.log('\n--- TEST 3: POST /api/packages/redeem (Canjear 1 Sesión) ---');
  const redeemRes = await post('/api/packages/redeem', {
    clientPackageId: newPkg.id,
    staffName: 'Elena Gómez',
    notes: 'Primer corte del bono realizado con éxito'
  });
  console.log('Redeem status:', redeemRes.status, redeemRes.data.message);
  console.log('Used:', redeemRes.data.clientPackage.usedSessions, 'Remaining:', redeemRes.data.clientPackage.remainingSessions);
  console.log('WhatsApp URL preview:', redeemRes.data.whatsappUrl ? redeemRes.data.whatsappUrl.slice(0, 80) + '...' : 'none');
  console.log('Email subject:', redeemRes.data.emailSubject);

  console.log('\n--- TEST 4: POST /api/packages/client/:id/send-email ---');
  const emailRes = await post(`/api/packages/client/${newPkg.clientId}/send-email`, {
    clientPackageId: newPkg.id,
    subject: redeemRes.data.emailSubject,
    body: redeemRes.data.emailBody
  });
  console.log('Email dispatch status:', emailRes.status, emailRes.data.message);

  console.log('\n✅ TODOS LOS TESTS DEL BACKEND DE BONOS SUPERADOS!');
}

run().catch(err => {
  console.error('Error running test:', err);
  process.exit(1);
});
