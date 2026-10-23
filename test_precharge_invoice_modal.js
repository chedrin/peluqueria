const fs = require('fs');
const assert = require('assert');
const http = require('http');

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

async function testPreChargeModal() {
  console.log('--- INICIANDO VERIFICACIÓN DE COMPROBACIÓN PREVIA EN TPV ---');

  const html = fs.readFileSync('public/index.html', 'utf8');

  // 1. Validar elementos DOM de la comprobación previa en ticket-modal
  const requiredDomElements = [
    'id="invoice-precharge-actions-bar"',
    'id="ticket-modal-title"',
    'id="ticket-modal-badge"',
    'id="ticket-modal-subtitle"',
    'id="inv-a4-badge"',
    'id="ticket-badge"',
    'id="modal-footer-status"',
    'id="modal-footer-status-icon"',
    'id="modal-footer-status-text"',
    'id="modal-footer-actions"',
    'id="btn-precharge-confirm-top"',
    'id="prepay-card"',
    'id="prepay-cash"',
    'id="prepay-bizum"'
  ];

  requiredDomElements.forEach(el => {
    assert(html.includes(el), `Debe contener el elemento DOM: ${el}`);
  });
  console.log('✅ Todos los elementos DOM de comprobación previa y botones están presentes en public/index.html');

  // 2. Validar funciones JS
  const requiredFunctions = [
    'async function executeFiscalInvoicing()',
    'function modifyTpvTicket()',
    'function setPreChargePaymentMethod(',
    'function updatePreChargePaymentButtons(',
    'async function confirmAndExecuteCharge()',
    'function showTicketModal('
  ];

  requiredFunctions.forEach(fn => {
    assert(html.includes(fn), `Debe contener la función JS: ${fn}`);
  });
  console.log('✅ Todas las funciones de control de comprobación previa están implementadas');

  // 3. Probar simulación lógica de creación de borrador previo y confirmación posterior
  console.log('▶ Simulando emisión de factura final tras comprobación...');
  const res = await request('POST', '/api/invoices', {
    series: 'FS2026',
    type: 'simplified',
    clientId: 'cli-1',
    items: [
      { concept: 'Corte y Estilismo (Comprobado)', quantity: 1, unitPrice: 22.00, vatRate: 21.0 },
      { concept: 'Descuento Canje Puntos Fidelización (-5,00 €)', quantity: 1, unitPrice: -5.00, vatRate: 21.0 }
    ],
    paymentMethod: 'cash'
  });

  assert.strictEqual(res.status, 201, 'Debe crear la factura confirmada con código 201');
  const inv = res.data;
  assert.strictEqual(inv.totalAmount, 17.00, 'El importe debe ser 17,00 € (22€ - 5€ dto)');
  console.log(`✅ Factura final confirmada emitida: ${inv.series}-${inv.invoiceNumber}, Total: ${inv.totalAmount} €`);

  // 4. Probar descarga de factura confirmada
  const resPrint = await request('GET', `/api/invoices/${inv.id}/print`);
  assert.strictEqual(resPrint.status, 200, 'GET print debe retornar 200');
  console.log(`✅ Endpoint de impresión/PDF oficial respondió HTTP 200 para la factura confirmada`);

  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE COMPROBACIÓN PREVIA Y MODIFICACIÓN DEL TPV HAN SIDO SUPERADAS CON ÉXITO!');
}

testPreChargeModal().catch(err => {
  console.error('❌ Error en test:', err);
  process.exit(1);
});
