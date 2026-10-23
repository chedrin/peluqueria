const http = require('http');
const fs = require('fs');
const assert = require('assert');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- INICIANDO TEST DE FIDELIZACIÓN Y DESCUENTO EN TPV ---');

  // 1. Obtener lista de clientes
  const resClients = await request('GET', '/api/clients');
  assert.strictEqual(resClients.status, 200, 'GET /api/clients debe retornar 200');
  const clients = resClients.data;
  assert(Array.isArray(clients), 'Clients debe ser un array');
  const laura = clients.find(c => c.id === 'cli-1' || c.name.includes('Laura'));
  assert(laura, 'Laura Martínez debe existir');
  console.log(`✅ Cliente encontrado: ${laura.name}, loyaltyPoints: ${laura.loyaltyPoints}, points: ${laura.points}`);
  assert(laura.loyaltyPoints >= 100, 'Laura Martínez debe tener al menos 100 puntos para el canje');
  const initialPts = laura.loyaltyPoints;

  // 2. Canjear 100 puntos (-100)
  const resRedeem = await request('POST', `/api/clients/${laura.id}/adjust-loyalty`, {
    action: 'redeem_points',
    deltaPoints: -100,
    note: 'Canje TPV de 100 pts por descuento de 5,00 €'
  });
  assert.strictEqual(resRedeem.status, 200, 'POST adjust-loyalty debe retornar 200');
  assert.strictEqual(resRedeem.data.client.loyaltyPoints, initialPts - 100, `El nuevo saldo debe ser ${initialPts - 100} puntos`);
  assert.strictEqual(resRedeem.data.client.points, initialPts - 100, `El nuevo points debe ser ${initialPts - 100}`);
  console.log(`✅ Canje de 100 puntos completado exitosamente. Saldo restante: ${resRedeem.data.client.loyaltyPoints} pts`);

  // 3. Crear factura con línea de descuento de 5,00 €
  const resInvoice = await request('POST', '/api/invoices', {
    series: 'FS2026',
    type: 'simplified',
    clientId: laura.id,
    items: [
      { concept: 'Corte y Estilismo', quantity: 1, unitPrice: 22.00, vatRate: 21.0 },
      { concept: 'Coloración Completa (Tinte)', quantity: 1, unitPrice: 38.00, vatRate: 21.0 },
      { concept: 'Descuento Canje Puntos Fidelización (-5,00 €)', quantity: 1, unitPrice: -5.00, vatRate: 21.0 }
    ],
    paymentMethod: 'card'
  });
  assert.strictEqual(resInvoice.status, 201, 'POST /api/invoices debe retornar 201');
  const invoice = resInvoice.data;
  console.log(`✅ Factura emitida: ${invoice.series}-${invoice.invoiceNumber}, Total: ${invoice.totalAmount} € (Bruto 60€ - 5€ dto = 55€)`);
  assert.strictEqual(invoice.totalAmount, 55.00, 'El total facturado debe ser 55,00 € con el descuento de 5€ aplicado');
  assert(invoice.recordHash, 'Debe incluir huella hash Veri*Factu');

  // 4. Probar reversión / restitución de puntos (+100)
  const resRestore = await request('POST', `/api/clients/${laura.id}/adjust-loyalty`, {
    action: 'restore_points',
    deltaPoints: 100,
    note: 'Restitución de prueba'
  });
  assert.strictEqual(resRestore.status, 200);
  assert.strictEqual(resRestore.data.client.loyaltyPoints, initialPts, `El saldo debe volver a ser ${initialPts} puntos`);
  console.log(`✅ Restitución de puntos comprobada: ${resRestore.data.client.loyaltyPoints} pts`);

  // 5. Validar elementos HTML y funciones JS en public/index.html
  const html = fs.readFileSync('public/index.html', 'utf8');
  const checks = [
    'id="tpv-client-select"',
    'id="tpv-appointment-select"',
    'id="tpv-client-points-badge"',
    'id="btn-tpv-redeem-100"',
    'id="btn-tpv-remove-discount"',
    'id="tpv-points-status-msg"',
    'function getActiveTpvClient()',
    'function getClientLoyaltyPoints(client)',
    'function onTpvClientChange(clientId)',
    'function updateTpvPointsBadge()',
    'async function applyLoyaltyPointsDiscount(',
    'async function removeLoyaltyPointsDiscount('
  ];

  for (const c of checks) {
    assert(html.includes(c), `public/index.html debe contener: ${c}`);
  }
  console.log('✅ Todos los elementos DOM y funciones JS de fidelización en TPV están presentes en index.html');

  console.log('\n🎉 ¡TODOS LOS TESTS DE CANJE DE PUNTOS Y TPV HAN SIDO EXITOSOS!');
}

runTests().catch(err => {
  console.error('❌ Error en test:', err);
  process.exit(1);
});
