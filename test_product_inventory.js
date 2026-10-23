const assert = require('assert');

async function runTests() {
  console.log('🧪 Iniciando test de Inventario de Productos y Proveedores...');

  // 1. GET /api/products
  const resGet = await fetch('http://localhost:3000/api/products');
  assert.strictEqual(resGet.status, 200, 'GET /api/products debería devolver 200');
  const products = await resGet.json();
  console.log(`✅ Catálogo cargado con ${products.length} productos iniciales.`);
  assert(products.length >= 3, 'Debe haber al menos 3 productos iniciales');

  // 2. PUT /api/products/prd-1 (Editar producto y proveedor)
  const editPayload = {
    sku: 'COS-001-MOD',
    name: 'Champú Reparador Argán Bio Oro (250ml)',
    brand: 'Moroccanoil Luxury',
    supplier: 'Distribuciones Capilares Premium SL',
    costPrice: 13.50,
    lastCostPrice: 13.50,
    price: 27.90,
    stock: 12,
    minStock: 4,
    isShowcase: true
  };

  const resPut = await fetch('http://localhost:3000/api/products/prd-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(editPayload)
  });

  assert.strictEqual(resPut.status, 200, 'PUT /api/products/prd-1 debería devolver 200');
  const putData = await resPut.json();
  console.log('✅ Respuesta PUT:', putData.message);
  assert.strictEqual(putData.success, true);
  assert.strictEqual(putData.product.name, 'Champú Reparador Argán Bio Oro (250ml)');
  assert.strictEqual(putData.product.supplier, 'Distribuciones Capilares Premium SL');
  assert.strictEqual(putData.product.costPrice, 13.50);
  assert.strictEqual(putData.product.price, 27.90);
  assert.strictEqual(putData.product.stock, 12);

  // 3. POST /api/products (Crear nuevo producto)
  const newProductPayload = {
    sku: 'SER-TEST-99',
    name: 'Aceite Protector Térmico 100ml',
    brand: 'GHD Salon Pro',
    supplier: 'GHD España Distribución',
    costPrice: 16.00,
    price: 32.00,
    stock: 7,
    minStock: 2,
    isShowcase: true
  };

  const resPost = await fetch('http://localhost:3000/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newProductPayload)
  });

  assert.strictEqual(resPost.status, 201, 'POST /api/products debería devolver 201');
  const postData = await resPost.json();
  console.log('✅ Producto creado:', postData.product.id, postData.product.name);
  assert(postData.product.id.startsWith('prd-'));
  assert.strictEqual(postData.product.supplier, 'GHD España Distribución');
  assert.strictEqual(postData.product.costPrice, 16.00);

  // 4. POST /api/products/:id/purchase (Registrar entrada de mercancía)
  const purchasePayload = {
    supplier: 'GHD España Distribución',
    units: 10,
    quantity: 10,
    unitCost: 15.50,
    costPrice: 15.50,
    invoiceNumber: 'FAC-2026-GHD-01',
    date: '2026-10-23'
  };

  const resPurchase = await fetch(`http://localhost:3000/api/products/${postData.product.id}/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(purchasePayload)
  });

  assert.strictEqual(resPurchase.status, 200, 'POST /api/products/:id/purchase debería devolver 200');
  const purchaseData = await resPurchase.json();
  console.log('✅ Entrada registrada:', purchaseData.message);
  assert.strictEqual(purchaseData.product.stock, 17); // 7 + 10
  assert.strictEqual(purchaseData.purchase.quantity, 10);
  assert.strictEqual(purchaseData.purchase.units, 10);
  assert.strictEqual(purchaseData.purchase.costPrice, 15.50);
  assert.strictEqual(purchaseData.purchase.unitCost, 15.50);

  // 5. Historial de compras en producto existente (prd-1)
  const resPrd1 = await fetch('http://localhost:3000/api/products');
  const updatedProducts = await resPrd1.json();
  const prd1 = updatedProducts.find(p => p.id === 'prd-1');
  assert(prd1.purchaseHistory.length >= 2, 'prd-1 debe tener al menos 2 compras en histórico');
  prd1.purchaseHistory.forEach((h, idx) => {
    const qty = h.units !== undefined ? h.units : h.quantity;
    const cost = h.unitCost !== undefined ? h.unitCost : h.costPrice;
    assert(typeof qty === 'number' && qty > 0, `Entrada ${idx} debe tener cantidad numérica`);
    assert(typeof cost === 'number' && cost > 0, `Entrada ${idx} debe tener coste numérico`);
  });
  console.log('✅ Histórico de compras validado sin errores de campos.');

  // 6. DELETE /api/products/:id
  const resDel = await fetch(`http://localhost:3000/api/products/${postData.product.id}`, {
    method: 'DELETE'
  });
  assert.strictEqual(resDel.status, 200, 'DELETE debería devolver 200');
  const delData = await resDel.json();
  console.log('✅ Producto de prueba eliminado correctamente:', delData.message);

  console.log('\n🎉 TODOS LOS TESTS DE INVENTARIO Y PROVEEDORES HAN PASADO EXITOSAMENTE!');
}

runTests().catch(err => {
  console.error('❌ Error en tests:', err);
  process.exit(1);
});
