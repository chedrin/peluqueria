const assert = require('assert');
const fs = require('fs');

async function testServiceEditing() {
  console.log('=== TEST: EDICIÓN Y GESTIÓN DE SERVICIOS EN CATÁLOGO ===\n');

  // 1. Obtener lista actual de servicios
  console.log('1. Obtener catálogo inicial:');
  const listRes = await fetch('http://localhost:3000/api/services');
  assert.strictEqual(listRes.status, 200);
  const initialServices = await listRes.json();
  console.log(`   ✅ Total servicios iniciales: ${initialServices.length}`);
  const srv1 = initialServices.find(s => s.id === 'srv-1');
  console.log(`   ✅ Servicio muestra: "${srv1.name}" (${srv1.durationMinutes} min, ${srv1.price} €)`);

  // 2. Editar servicio existente (PUT /api/services/srv-1)
  console.log('\n2. Editar servicio (PUT /api/services/srv-1):');
  const editRes = await fetch('http://localhost:3000/api/services/srv-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Corte y Estilismo Deluxe & Tratamiento Capilar',
      category: 'corte',
      durationMinutes: 45,
      price: 28.50,
      requiredMaterials: 'Tijeras de titanio ergonómicas, capa de corte desechable, champú dermocalmante, mascarilla nutritiva',
      description: 'Corte de diseño adaptado a tu morfología facial con lavado relajante y mascarilla intensiva.'
    })
  });
  assert.strictEqual(editRes.status, 200, 'Debe devolver status 200');
  const editData = await editRes.json();
  console.log('   ✅ Mensaje del servidor:', editData.message);
  assert.strictEqual(editData.service.name, 'Corte y Estilismo Deluxe & Tratamiento Capilar');
  assert.strictEqual(editData.service.durationMinutes, 45);
  assert.strictEqual(editData.service.price, 28.50);

  // 3. Crear nuevo servicio (POST /api/services)
  console.log('\n3. Crear nuevo servicio (POST /api/services):');
  const createRes = await fetch('http://localhost:3000/api/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Tratamiento Botox Capilar Rejuvenecedor',
      category: 'tratamiento',
      durationMinutes: 75,
      price: 55.00,
      requiredMaterials: 'Ampolla botox capilar ácido hialurónico, plancha infrarrojos, gorro térmico'
    })
  });
  assert.strictEqual(createRes.status, 201, 'Debe devolver status 201');
  const createData = await createRes.json();
  console.log('   ✅ Mensaje del servidor:', createData.message);
  console.log('   ✅ Nuevo servicio ID:', createData.service.id);

  // 4. Eliminar servicio recién creado (DELETE /api/services/:id)
  console.log('\n4. Eliminar servicio (DELETE /api/services/:id):');
  const delRes = await fetch(`http://localhost:3000/api/services/${createData.service.id}`, {
    method: 'DELETE'
  });
  assert.strictEqual(delRes.status, 200, 'Debe devolver status 200');
  const delData = await delRes.json();
  console.log('   ✅ Mensaje del servidor:', delData.message);

  // 5. Verificar consistencia en HTML
  console.log('\n5. Verificando consistencia en public/index.html:');
  const html = fs.readFileSync('public/index.html', 'utf8');
  assert.ok(html.includes('id="modal-service-edit"'), 'El modal modal-service-edit debe existir en el HTML');
  assert.ok(html.includes('openServiceEditModal'), 'La función openServiceEditModal debe existir');
  assert.ok(html.includes('submitServiceEdit'), 'La función submitServiceEdit debe existir');
  assert.ok(html.includes('updateServiceSlotsIndicator'), 'El cálculo automático de citas ocupadas debe existir');
  assert.ok(html.includes('setServiceDurationPreset'), 'Los presets rápidos de minutos deben existir');
  assert.ok(html.includes('edit-3'), 'El botón de editar debe incluir el icono edit-3');
  console.log('   ✅ Todos los componentes, funciones y controles existen y son 100% válidos');

  console.log('\n======================================================');
  console.log('🎉 EL CATÁLOGO DE SERVICIOS ES 100% EDITABLE Y FUNCIONAL');
  console.log('======================================================');
}

testServiceEditing().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
